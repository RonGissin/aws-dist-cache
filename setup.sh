#!/bin/bash
# debug
# set -o xtrace

################################ VARIABLES ######################################
KEY_NAME="dist-cache-`date +'%N'`"
KEY_PEM="$KEY_NAME.pem"
UBUNTU_AMI="ami-05d72852800cbf29e" 
ROLE_NAME="DistCacheDynamoDB"
UBUNTU_AMI="ami-05d72852800cbf29e"
INSTANCE_PROFILE="DistCacheInstanceProfile"
DYNAMO_DB_FULL_ACCESS_POLICY_ARN="arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
TABLE_NAME="CacheServers"

####################### CREATE ROLE AND INSTANCE PROFILE ########################
echo "creating IAM service role - $ROLE_NAME for ec2 to assume"
aws iam create-role --role-name $ROLE_NAME --description "role to allow access to dynamodb" --assume-role-policy-document file://RoleEC2TrustPolicy.json
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn  $DYNAMO_DB_FULL_ACCESS_POLICY_ARN
aws iam create-instance-profile --instance-profile-name $INSTANCE_PROFILE
aws iam add-role-to-instance-profile --role-name $ROLE_NAME --instance-profile-name $INSTANCE_PROFILE 

############################## CREATE PEM FILE ##################################
echo "create key pair $KEY_PEM to connect to instances and save locally"
aws ec2 create-key-pair --key-name $KEY_NAME --query "KeyMaterial" --output text > $KEY_PEM 
echo "key pair .pem file has been created in the current directory"

# secure the key pair
chmod 400 $KEY_PEM


############################ CREATE DYNAMODB TABLE ##############################
echo "creating dynamoDB table for health reporting"
aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
--provisioned-throughput \
        ReadCapacityUnits=10,WriteCapacityUnits=5


#################### CREATE SECURITY GROUP + CONFIGURE RULES - FOR MANAGER ####################
SEC_GRP="cl-sg-`date +'%N'`"

echo "setup firewall $SEC_GRP"
aws ec2 create-security-group   \
    --group-name $SEC_GRP       \
    --description "Access my instances" 

# figure out my ip
MY_IP=$(curl ipinfo.io/ip)
echo "My IP: $MY_IP"


echo "setup rule allowing SSH access to $MY_IP only"
aws ec2 authorize-security-group-ingress        \
    --group-name $SEC_GRP --port 22 --protocol tcp \
    --cidr $MY_IP/32

echo "setup rule allowing HTTP (port 5000) access to $MY_IP only"
aws ec2 authorize-security-group-ingress        \
    --group-name $SEC_GRP --port 5000 --protocol tcp \
    --cidr $MY_IP/32

############################### CREATE EC2 - MANAGER ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --iam-instance-profile Name=$INSTANCE_PROFILE       \
    --security-groups $SEC_GRP)

INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP_MANAGER=$(aws ec2 describe-instances  --instance-ids $INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

echo "Created new instance $INSTANCE_ID @ $PUBLIC_IP_MANAGER"

############################# SETUP EC2 APP ENV #################################
echo "setup production environment on instance"
ssh -i $KEY_PEM -o "StrictHostKeyChecking=no" -o "ConnectionAttempts=10" ec2-user@$PUBLIC_IP_MANAGER <<EOF
    # update
    # sudo yum update -y
    # install git
    sudo yum install git -y
    # install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
    # activate nvm
    . ~/.nvm/nvm.sh
    # install node
    nvm install node
    # get app from github
    git clone https://github.com/RonGissin/aws-dist-cache.git
    # install dependencies
    cd aws-dist-cache
    cd cache-manager
    npm install -g typescript
    npm install forever -g
    npm install
    # run app
    npm run build
    nohup forever start dist/app.js --host 0.0.0.0  &>/dev/null &
    exit
EOF

############################# SETUP NODE INSTANCES #################################

#################### CREATE SECURITY GROUP + CONFIGURE RULES - NODES ####################
SEC_GRP_NODES="cl-sg-nodes-`date +'%N'`"

echo "setup firewall $SEC_GRP_NODES"
aws ec2 create-security-group   \
    --group-name $SEC_GRP_NODES       \
    --description "Allow access from manager" 

echo "setup rule allowing SSH access to $MY_IP only"
aws ec2 authorize-security-group-ingress        \
    --group-name $SEC_GRP_NODES --port 22 --protocol tcp \
    --cidr $MY_IP/32

echo "setup rule allowing HTTP (port 5000) access to $PUBLIC_IP_MANAGER only"
aws ec2 authorize-security-group-ingress        \
    --group-name $SEC_GRP_NODES --port 5000 --protocol tcp \
    --cidr $PUBLIC_IP_MANAGER/32

############################### CREATE EC2 - FIRST NODE POOL ONE ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --iam-instance-profile Name=$INSTANCE_PROFILE       \
    --security-groups $SEC_GRP_NODES)

NODE_INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $NODE_INSTANCE_ID

PUBLIC_IP_NODE=$(aws ec2 describe-instances  --instance-ids $NODE_INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

curl -d "{\"serverIp\": \"$PUBLIC_IP_NODE\", \"newPrimaryNode\": true}" -H "Content-Type: application/json" -X POST http://$PUBLIC_IP_MANAGER:5000/addNode

echo "Created new instance $NODE_INSTANCE_ID @ $PUBLIC_IP_NODE"

############################# SETUP EC2 NODE APP ENV #################################
echo "setup production environment on instance"
ssh -i $KEY_PEM -o "StrictHostKeyChecking=no" -o "ConnectionAttempts=10" ec2-user@$PUBLIC_IP_NODE <<EOF
    # update
    # sudo yum update -y
    # install git
    sudo yum install git -y
    # install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
    # activate nvm
    . ~/.nvm/nvm.sh
    # install node
    nvm install node
    # get app from github
    git clone https://github.com/RonGissin/aws-dist-cache.git
    # install dependencies
    cd aws-dist-cache
    cd cache-server
    mkdir dist && touch dist/ipconfig.txt
    curl http://169.254.169.254/latest/meta-data/public-ipv4 > dist/ipconfig.txt
    npm install -g typescript
    npm install forever -g
    npm install
    # run app
    npm run build
    nohup forever start dist/app.js --host 0.0.0.0  &>/dev/null &
    exit
EOF

############################### CREATE EC2 - SECOND NODE POOL ONE ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --iam-instance-profile Name=$INSTANCE_PROFILE       \
    --security-groups $SEC_GRP_NODES)

NODE_INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $NODE_INSTANCE_ID

PUBLIC_IP_NODE=$(aws ec2 describe-instances  --instance-ids $NODE_INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

curl -d "{\"serverIp\": \"$PUBLIC_IP_NODE\", \"newPrimaryNode\": false}" -H "Content-Type: application/json" -X POST http://$PUBLIC_IP_MANAGER:5000/addNode

echo "Created new instance $INSTANCE_ID @ $PUBLIC_IP_NODE"

############################# SETUP EC2 NODE APP ENV #################################
echo "setup production environment on instance"
ssh -i $KEY_PEM -o "StrictHostKeyChecking=no" -o "ConnectionAttempts=10" ec2-user@$PUBLIC_IP_NODE <<EOF
    # update
    # sudo yum update -y
    # install git
    sudo yum install git -y
    # install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
    # activate nvm
    . ~/.nvm/nvm.sh
    # install node
    nvm install node
    # get app from github
    git clone https://github.com/RonGissin/aws-dist-cache.git
    # install dependencies
    cd aws-dist-cache
    cd cache-server
    mkdir dist && touch dist/ipconfig.txt
    curl http://169.254.169.254/latest/meta-data/public-ipv4 > dist/ipconfig.txt
    npm install -g typescript
    npm install forever -g
    npm install
    # run app
    npm run build
    nohup forever start dist/app.js --host 0.0.0.0  &>/dev/null &
    exit
EOF

############################### CREATE EC2 - FIRST NODE POOL TWO ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --iam-instance-profile Name=$INSTANCE_PROFILE       \
    --security-groups $SEC_GRP_NODES)

NODE_INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $NODE_INSTANCE_ID

PUBLIC_IP_NODE=$(aws ec2 describe-instances  --instance-ids $NODE_INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

curl -d "{\"serverIp\": \"$PUBLIC_IP_NODE\", \"newPrimaryNode\": true}" -H "Content-Type: application/json" -X POST http://$PUBLIC_IP_MANAGER:5000/addNode

echo "Created new instance $NODE_INSTANCE_ID @ $PUBLIC_IP_NODE"

############################# SETUP EC2 NODE APP ENV #################################
echo "setup production environment on instance"
ssh -i $KEY_PEM -o "StrictHostKeyChecking=no" -o "ConnectionAttempts=10" ec2-user@$PUBLIC_IP_NODE <<EOF
    # update
    # sudo yum update -y
    # install git
    sudo yum install git -y
    # install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
    # activate nvm
    . ~/.nvm/nvm.sh
    # install node
    nvm install node
    # get app from github
    git clone https://github.com/RonGissin/aws-dist-cache.git
    # install dependencies
    cd aws-dist-cache
    cd cache-server
    mkdir dist && touch dist/ipconfig.txt
    curl http://169.254.169.254/latest/meta-data/public-ipv4 > dist/ipconfig.txt
    npm install -g typescript
    npm install forever -g
    npm install
    # run app
    npm run build
    nohup forever start dist/app.js --host 0.0.0.0  &>/dev/null &
    exit
EOF

############################### CREATE EC2 - SECOND NODE POOL TWO ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --iam-instance-profile Name=$INSTANCE_PROFILE       \
    --security-groups $SEC_GRP_NODES)

NODE_INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $NODE_INSTANCE_ID

PUBLIC_IP_NODE=$(aws ec2 describe-instances  --instance-ids $NODE_INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

curl -d "{\"serverIp\": \"$PUBLIC_IP_NODE\", \"newPrimaryNode\": false}" -H "Content-Type: application/json" -X POST http://$PUBLIC_IP_MANAGER:5000/addNode

echo "Created new instance $NODE_INSTANCE_ID @ $PUBLIC_IP_NODE"

############################# SETUP EC2 NODE APP ENV #################################
echo "setup production environment on instance"
ssh -i $KEY_PEM -o "StrictHostKeyChecking=no" -o "ConnectionAttempts=10" ec2-user@$PUBLIC_IP_NODE <<EOF
    # update
    # sudo yum update -y
    # install git
    sudo yum install git -y
    # install nvm
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
    # activate nvm
    . ~/.nvm/nvm.sh
    # install node
    nvm install node
    # get app from github
    git clone https://github.com/RonGissin/aws-dist-cache.git
    # install dependencies
    cd aws-dist-cache
    cd cache-server
    mkdir dist && touch dist/ipconfig.txt
    curl http://169.254.169.254/latest/meta-data/public-ipv4 > dist/ipconfig.txt
    npm install -g typescript
    npm install forever -g
    npm install
    # run app
    npm run build
    nohup forever start dist/app.js --host 0.0.0.0  &>/dev/null &
    exit
EOF

