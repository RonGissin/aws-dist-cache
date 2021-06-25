/**
 * A module that defines the Maybe type for null safety.
 */

export enum MaybeType {
    Just = 'maybe-type__just',
    Nothing = 'maybe-type__nothing',
}

export interface Just<T> {
    type: typeof MaybeType.Just
    value: T
}

export interface Nothing {
    type: typeof MaybeType.Nothing
}

export type Maybe<T> = Just<T> | Nothing

export const Nothing = (): Nothing => ({
    type: MaybeType.Nothing,
})

export const Just = <T> (value: T): Just<T> => ({
    type: MaybeType.Just,
    value,
})