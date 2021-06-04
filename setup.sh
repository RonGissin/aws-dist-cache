#!/bin/bash
# debug
# set -o xtrace

################################ VARIABLES ######################################
KEY_NAME="dist-cache-`date +'%N'`"
KEY_PEM="$KEY_NAME.pem"
UBUNTU_AMI="ami-05d72852800cbf29e"  

############################## CREATE PEM FILE ##################################
echo "create key pair $KEY_PEM to connect to instances and save locally"
aws ec2 create-key-pair --key-name $KEY_NAME --query "KeyMaterial" --output text > $KEY_PEM 
echo "key pair .pem file has been created in the current directory"

# secure the key pair
chmod 400 $KEY_PEM

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
    sudo yum update -y
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
    cd cache-manager
    npm install -g typescript
    npm install
    # run app
    npm run build
    nohup npm start --host 0.0.0.0  &>/dev/null &
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

############################### CREATE EC2 - NODE ######################################
echo "Creating Ubuntu instance with ami -> $UBUNTU_AMI..."
RUN_INSTANCES=$(aws ec2 run-instances   \
    --image-id $UBUNTU_AMI        \
    --instance-type t2.micro            \
    --key-name $KEY_NAME                \
    --security-groups $SEC_GRP_NODES)

NODE_INSTANCE_ID=$(echo $RUN_INSTANCES | jq -r '.Instances[0].InstanceId')

echo "Waiting for instance creation..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

PUBLIC_IP_NODE=$(aws ec2 describe-instances  --instance-ids $INSTANCE_ID | 
    jq -r '.Reservations[0].Instances[0].PublicIpAddress'
)

curl -X POST -H "Content-Type: application/json" \
    -d "{'serverIp': $PUBLIC_IP_NODE}" \
    http://$PUBLIC_IP_MANAGER:5000/addNode


echo "Created new instance $INSTANCE_ID @ $PUBLIC_IP_NODE"





echo "test that it all worked"
curl  --retry-connrefused --retry 10 --retry-delay 5  http://$PUBLIC_IP:3000/ping

printf "\nCLOUDLOT API IS NOW RUNNING :-) \n 
        The API exposes the following endpoints: \n 
        POST $PUBLIC_IP/entry?plate=<license-plate>&parkingLot=<parking-lot-id> \n 
        POST $PUBLIC_IP/exit?ticketId=<ticket-id> \n \n 
        ENJOY"

exit