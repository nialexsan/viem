import type {
  Abi,
  AbiConstructor,
  AbiError,
  AbiEvent,
  AbiFunction,
  AbiParameter,
  AbiParameterToPrimitiveType,
  AbiParametersToPrimitiveTypes,
  AbiStateMutability,
  Address,
  ExtractAbiError,
  ExtractAbiErrorNames,
  ExtractAbiEvent,
  ExtractAbiEventNames,
  ExtractAbiFunction,
  ExtractAbiFunctionNames,
  ResolvedConfig,
} from 'abitype'

import type { Hex, LogTopic } from './misc.js'
import type { TransactionRequest } from './transaction.js'
import type {
  Filter,
  IsNarrowable,
  IsUnion,
  MaybeRequired,
  NoUndefined,
  Prettify,
  UnionToTuple,
} from './utils.js'

export type ContractFunctionName<
  abi extends Abi | readonly unknown[] = Abi,
  mutability extends AbiStateMutability = AbiStateMutability,
> = ExtractAbiFunctionNames<
  abi extends Abi ? abi : Abi,
  mutability
> extends infer functionName extends string
  ? [functionName] extends [never]
    ? string
    : functionName
  : string

export type ContractFunctionArgs<
  abi extends Abi | readonly unknown[] = Abi,
  mutability extends AbiStateMutability = AbiStateMutability,
  functionName extends ContractFunctionName<
    abi,
    mutability
  > = ContractFunctionName<abi, mutability>,
> = AbiParametersToPrimitiveTypes<
  ExtractAbiFunction<
    abi extends Abi ? abi : Abi,
    functionName,
    mutability
  >['inputs'],
  'inputs'
> extends infer args
  ? [args] extends [never]
    ? readonly unknown[]
    : args
  : readonly unknown[]

export type Widen<type> =
  | ([unknown] extends [type] ? unknown : never)
  | (type extends Function ? type : never)
  | (type extends ResolvedConfig['BigIntType'] ? bigint : never)
  | (type extends boolean ? boolean : never)
  | (type extends ResolvedConfig['IntType'] ? number : never)
  | (type extends string
      ? type extends ResolvedConfig['AddressType']
        ? ResolvedConfig['AddressType']
        : type extends ResolvedConfig['BytesType']['inputs']
        ? ResolvedConfig['BytesType']
        : string
      : never)
  | (type extends readonly [] ? readonly [] : never)
  | (type extends Record<string, unknown>
      ? { [K in keyof type]: Widen<type[K]> }
      : never)
  | (type extends { length: number }
      ? {
          [K in keyof type]: Widen<type[K]>
        } extends infer Val extends readonly unknown[]
        ? readonly [...Val]
        : never
      : never)

export type ExtractAbiFunctionForArgs<
  abi extends Abi,
  mutability extends AbiStateMutability,
  functionName extends ContractFunctionName<abi, mutability>,
  args extends ContractFunctionArgs<abi, mutability, functionName>,
> = ExtractAbiFunction<
  abi,
  functionName,
  mutability
> extends infer abiFunction extends AbiFunction
  ? IsUnion<abiFunction> extends true // narrow overloads using `args` by converting to tuple and filtering out overloads that don't match
    ? UnionToTuple<abiFunction> extends infer abiFunctions extends readonly AbiFunction[]
      ? {
          [k in keyof abiFunctions]: args extends AbiParametersToPrimitiveTypes<
            abiFunctions[k]['inputs'],
            'inputs'
          >
            ? abiFunctions[k]
            : never
        }[number] // convert back to union (removes `never` tuple entries: `['foo', never, 'bar'][number]` => `'foo' | 'bar'`)
      : never
    : abiFunction
  : never

export type ContractFunctionParameters<
  abi extends Abi | readonly unknown[] = Abi,
  mutability extends AbiStateMutability = AbiStateMutability,
  functionName extends ContractFunctionName<
    abi,
    mutability
  > = ContractFunctionName<abi, mutability>,
  args extends ContractFunctionArgs<
    abi,
    mutability,
    functionName
  > = ContractFunctionArgs<abi, mutability, functionName>,
  ///
  allArgs = ContractFunctionArgs<abi, mutability, functionName>,
  allFunctionNames = ContractFunctionName<abi, mutability>,
  // when `args` is inferred to `readonly []` ("inputs": []) or `never` (`abi` declared as `Abi` or not inferrable), allow `args` to be optional.
  // important that both branches return same structural type
> = readonly [] extends allArgs
  ? {
      address: Address
      abi: abi
      functionName:
        | allFunctionNames // show all options
        | (functionName extends allFunctionNames ? functionName : never) // infer value
      args?:
        | allArgs // show all options
        | (args extends allArgs ? Widen<args> : never) // infer value, widen inferred value of `args` conditionally to match `allArgs`
        | undefined
    }
  : {
      address: Address
      abi: abi
      functionName:
        | allFunctionNames // show all options
        | (functionName extends allFunctionNames ? functionName : never) // infer value
      args:
        | allArgs // show all options
        | Widen<args> // infer value, widen inferred value of `args` match `allArgs` (e.g. avoid union `args: readonly [123n] | readonly [bigint]`)
    }

export type ContractFunctionReturnType<
  abi extends Abi | readonly unknown[] = Abi,
  mutability extends AbiStateMutability = AbiStateMutability,
  functionName extends ContractFunctionName<
    abi,
    mutability
  > = ContractFunctionName<abi, mutability>,
  args extends ContractFunctionArgs<
    abi,
    mutability,
    functionName
  > = ContractFunctionArgs<abi, mutability, functionName>,
> = abi extends Abi
  ? Abi extends abi
    ? unknown
    : AbiParametersToPrimitiveTypes<
        ExtractAbiFunctionForArgs<
          abi,
          mutability,
          functionName,
          readonly [] extends args ? readonly [] : args
        >['outputs']
      > extends infer types
    ? types extends readonly []
      ? void
      : types extends readonly [infer type]
      ? type
      : types
    : never
  : unknown

export type AbiItem = Abi[number]

export type EventDefinition = `${string}(${string})`

export type ContractParameters<
  abi extends Abi | readonly unknown[] = readonly unknown[],
  stateMutability extends AbiStateMutability = AbiStateMutability,
  functionName extends ExtractAbiFunctionNames<
    abi extends Abi ? abi : Abi,
    stateMutability
  > = string,
  ///
  functionNames extends string = abi extends Abi
    ? ExtractAbiFunctionNames<abi, stateMutability>
    : string,
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<
        abi,
        functionName extends functionNames ? functionName : functionNames, // fallback to all function names if `functionName` is invalid
        stateMutability
      >
    : AbiFunction,
  types = AbiParametersToPrimitiveTypes<abiFunction['inputs'], 'inputs'>,
  args =
    | types // show all values
    | (Abi extends abi ? readonly unknown[] | undefined : never) // `abi` declared as `Abi`
    | (readonly [] extends types ? undefined : never), // `abiFunction` has no inputs
  isArgsOptional extends boolean = Abi extends abi
    ? true
    : readonly [] extends types
    ? true
    : false,
> = {
  abi: abi
  address: Address
  functionName:
    | functionNames // show all values
    | (functionName extends functionNames ? functionName : never) // validate `functionName`
    | ([functionNames] extends [never] ? string : never) // `abi` declared as `Abi`
} & (isArgsOptional extends true ? { args?: args | undefined } : { args: args })

export type ContractReturnType<
  abi extends Abi | readonly unknown[] = readonly unknown[],
  stateMutability extends AbiStateMutability = AbiStateMutability,
  functionName extends ExtractAbiFunctionNames<
    abi extends Abi ? abi : Abi,
    stateMutability
  > = string,
  ///
  abiFunction extends AbiFunction = abi extends Abi
    ? ExtractAbiFunction<abi, functionName, stateMutability>
    : AbiFunction,
  types = AbiParametersToPrimitiveTypes<abiFunction['outputs'], 'outputs'>,
> = [abiFunction] extends [never]
  ? unknown // `abiFunction` was not inferrable (e.g. `abi` declared as `Abi`)
  : readonly unknown[] extends types
  ? unknown // `abiFunction` was not inferrable (e.g. `abi` not const asserted)
  : types extends readonly [] // unwrap `types`
  ? void // no outputs
  : types extends readonly [infer type]
  ? type // single output
  : types

export type ContractFunctionConfig<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends string = string,
  TAbiStateMutability extends AbiStateMutability = AbiStateMutability,
> = {
  /** Contract ABI */
  abi: TAbi
  /** Contract address */
  address: Address
  /** Function to invoke on the contract */
  functionName: InferFunctionName<TAbi, TFunctionName, TAbiStateMutability>
} & GetFunctionArgs<TAbi, TFunctionName>

export type ContractFunctionResult<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends string = string,
  TAbiFunction extends AbiFunction & {
    type: 'function'
  } = TAbi extends Abi ? ExtractAbiFunction<TAbi, TFunctionName> : AbiFunction,
  TArgs = AbiParametersToPrimitiveTypes<TAbiFunction['outputs']>,
  FailedToParseArgs =
    | ([TArgs] extends [never] ? true : false)
    | (readonly unknown[] extends TArgs ? true : false),
> = true extends FailedToParseArgs
  ? unknown
  : TArgs extends readonly []
  ? void
  : TArgs extends readonly [infer Arg]
  ? Arg
  : TArgs

export type GetValue<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends string,
  TValueType = TransactionRequest['value'],
  TAbiFunction extends AbiFunction = TAbi extends Abi
    ? ExtractAbiFunction<TAbi, TFunctionName>
    : AbiFunction,
  _Narrowable extends boolean = IsNarrowable<TAbi, Abi>,
> = _Narrowable extends true
  ? TAbiFunction['stateMutability'] extends 'payable'
    ? { value: NoUndefined<TValueType> }
    : TAbiFunction['payable'] extends true
    ? { value: NoUndefined<TValueType> }
    : { value?: never }
  : { value?: TValueType }

export type MaybeAbiEventName<TAbiEvent extends AbiEvent | undefined> =
  TAbiEvent extends AbiEvent ? TAbiEvent['name'] : undefined

export type MaybeExtractEventArgsFromAbi<
  TAbi extends Abi | readonly unknown[] | undefined,
  TEventName extends string | undefined,
> = TAbi extends Abi | readonly unknown[]
  ? TEventName extends string
    ? GetEventArgs<TAbi, TEventName>
    : undefined
  : undefined

//////////////////////////////////////////////////////////////////////
// ABI item name

export type InferErrorName<
  TAbi extends Abi | readonly unknown[] = Abi,
  TErrorName extends string | undefined = string,
> = TAbi extends Abi
  ? ExtractAbiErrorNames<TAbi> extends infer AbiErrorNames
    ?
        | AbiErrorNames
        | (TErrorName extends AbiErrorNames ? TErrorName : never)
        | (Abi extends TAbi ? string : never)
    : never
  : TErrorName

export type InferEventName<
  TAbi extends Abi | readonly unknown[] = Abi,
  TEventName extends string | undefined = string,
> = TAbi extends Abi
  ? ExtractAbiEventNames<TAbi> extends infer AbiEventNames
    ? AbiEventNames | (TEventName extends AbiEventNames ? TEventName : never)
    : never
  : TEventName

export type InferFunctionName<
  TAbi extends Abi | readonly unknown[] = Abi,
  TFunctionName extends string | undefined = string,
  TAbiStateMutability extends AbiStateMutability = AbiStateMutability,
> = TAbi extends Abi
  ? ExtractAbiFunctionNames<
      TAbi,
      TAbiStateMutability
    > extends infer AbiFunctionNames
    ?
        | AbiFunctionNames
        | (TFunctionName extends AbiFunctionNames ? TFunctionName : never)
        | (Abi extends TAbi ? string : never)
    : never
  : TFunctionName

export type InferItemName<
  TAbi extends Abi | readonly unknown[] = Abi,
  TName extends string = string,
> = TAbi extends Abi
  ? ExtractAbiItemNames<TAbi> extends infer AbiNames
    ?
        | AbiNames
        | (TName extends AbiNames ? TName : never)
        | (Abi extends TAbi ? string : never)
    : never
  : TName
type ExtractAbiItemNames<TAbi extends Abi> =
  | ExtractAbiFunctionNames<TAbi>
  | ExtractAbiEventNames<TAbi>
  | ExtractAbiErrorNames<TAbi>

//////////////////////////////////////////////////////////////////////
// ABI item args

export type GetFunctionArgs<
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends string,
  TAbiFunction extends AbiFunction = TAbi extends Abi
    ? ExtractAbiFunction<TAbi, TFunctionName>
    : AbiFunction,
  TArgs = AbiParametersToPrimitiveTypes<TAbiFunction['inputs']>,
  FailedToParseArgs =
    | ([TArgs] extends [never] ? true : false)
    | (readonly unknown[] extends TArgs ? true : false),
> = true extends FailedToParseArgs
  ? {
      /**
       * Arguments to pass contract method
       *
       * Use a [const assertion](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) on {@link abi} for type inference.
       */
      args?: readonly unknown[]
    }
  : TArgs extends readonly []
  ? { args?: never }
  : {
      /** Arguments to pass contract method */ args: TArgs
    }

export type GetConstructorArgs<
  TAbi extends Abi | readonly unknown[],
  TAbiConstructor extends AbiConstructor = TAbi extends Abi
    ? Extract<TAbi[number], { type: 'constructor' }>
    : AbiConstructor,
  TArgs = AbiParametersToPrimitiveTypes<TAbiConstructor['inputs']>,
  FailedToParseArgs =
    | ([TArgs] extends [never] ? true : false)
    | (readonly unknown[] extends TArgs ? true : false),
> = true extends FailedToParseArgs
  ? {
      /**
       * Arguments to pass contract constructor
       *
       * Use a [const assertion](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) on {@link abi} for type inference.
       */
      args?: readonly unknown[]
    }
  : TArgs extends readonly []
  ? { args?: never }
  : {
      /** Arguments to pass contract constructor */ args: TArgs
    }

export type GetErrorArgs<
  TAbi extends Abi | readonly unknown[],
  TErrorName extends string,
  TAbiError extends AbiError = TAbi extends Abi
    ? ExtractAbiError<TAbi, TErrorName>
    : AbiError,
  TArgs = AbiParametersToPrimitiveTypes<TAbiError['inputs']>,
  FailedToParseArgs =
    | ([TArgs] extends [never] ? true : false)
    | (readonly unknown[] extends TArgs ? true : false),
> = true extends FailedToParseArgs
  ? {
      /**
       * Arguments to pass contract method
       *
       * Use a [const assertion](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) on {@link abi} for type inference.
       */
      args?: readonly unknown[]
    }
  : TArgs extends readonly []
  ? { args?: never }
  : {
      /** Arguments to pass contract method */ args: TArgs
    }

export type GetEventArgs<
  TAbi extends Abi | readonly unknown[],
  TEventName extends string,
  TConfig extends EventParameterOptions = DefaultEventParameterOptions,
  TAbiEvent extends AbiEvent & { type: 'event' } = TAbi extends Abi
    ? ExtractAbiEvent<TAbi, TEventName>
    : AbiEvent & { type: 'event' },
  TArgs = AbiEventParametersToPrimitiveTypes<TAbiEvent['inputs'], TConfig>,
  FailedToParseArgs =
    | ([TArgs] extends [never] ? true : false)
    | (readonly unknown[] extends TArgs ? true : false),
> = true extends FailedToParseArgs
  ? readonly unknown[] | Record<string, unknown>
  : TArgs

export type GetEventArgsFromTopics<
  TAbi extends Abi | readonly unknown[],
  TEventName extends string,
  TTopics extends LogTopic[],
  TData extends Hex | undefined,
  TStrict extends boolean = true,
  TAbiEvent extends AbiEvent & { type: 'event' } = TAbi extends Abi
    ? ExtractAbiEvent<TAbi, TEventName>
    : AbiEvent & { type: 'event' },
  TArgs = AbiEventParametersToPrimitiveTypes<
    TAbiEvent['inputs'],
    { EnableUnion: false; IndexedOnly: false; Required: TStrict }
  >,
> = TTopics extends readonly []
  ? TData extends undefined
    ? { args?: never }
    : { args?: TArgs }
  : { args: TArgs }

//////////////////////////////////////////////////////////////////////
// ABI event types

type EventParameterOptions = {
  EnableUnion?: boolean
  IndexedOnly?: boolean
  Required?: boolean
}
type DefaultEventParameterOptions = {
  EnableUnion: true
  IndexedOnly: true
  Required: false
}

type HashedEventTypes = 'bytes' | 'string' | 'tuple' | `${string}[${string}]`

// TODO: Speed up by returning immediately as soon as named parameter is found.
type _HasUnnamedAbiParameter<TAbiParameters extends readonly AbiParameter[]> =
  TAbiParameters extends readonly [
    infer Head extends AbiParameter,
    ...infer Tail extends readonly AbiParameter[],
  ]
    ? Head extends { name: string }
      ? Head['name'] extends ''
        ? true
        : _HasUnnamedAbiParameter<Tail>
      : true
    : false

/**
 * @internal
 */
export type LogTopicType<
  TPrimitiveType = Hex,
  TTopic extends LogTopic = LogTopic,
> = TTopic extends Hex
  ? TPrimitiveType
  : TTopic extends Hex[]
  ? TPrimitiveType[]
  : TTopic extends null
  ? null
  : never

/**
 * @internal
 */
export type AbiEventParameterToPrimitiveType<
  TAbiParameter extends AbiParameter,
  Options extends EventParameterOptions = DefaultEventParameterOptions,
  _Type = AbiParameterToPrimitiveType<TAbiParameter>,
> = Options['EnableUnion'] extends true ? LogTopicType<_Type> : _Type

/**
 * @internal
 */
export type AbiEventTopicToPrimitiveType<
  TAbiParameter extends AbiParameter,
  TTopic extends LogTopic,
  TPrimitiveType = TAbiParameter['type'] extends HashedEventTypes
    ? TTopic
    : AbiParameterToPrimitiveType<TAbiParameter>,
> = LogTopicType<TPrimitiveType, TTopic>

export type AbiEventParametersToPrimitiveTypes<
  TAbiParameters extends readonly AbiParameter[],
  Options extends EventParameterOptions = DefaultEventParameterOptions,
  // Remove non-indexed parameters based on `Options['IndexedOnly']`
> = TAbiParameters extends readonly []
  ? readonly []
  : Filter<
      TAbiParameters,
      Options['IndexedOnly'] extends true ? { indexed: true } : object
    > extends infer Filtered extends readonly AbiParameter[]
  ? _HasUnnamedAbiParameter<Filtered> extends true
    ? // Has unnamed tuple parameters so return as array
        | readonly [
            ...{
              [K in keyof Filtered]: AbiEventParameterToPrimitiveType<
                Filtered[K],
                Options
              >
            },
          ]
        // Distribute over tuple to represent optional parameters
        | (Options['Required'] extends true
            ? never
            : // Distribute over tuple to represent optional parameters
            Filtered extends readonly [
                ...infer Head extends readonly AbiParameter[],
                infer _,
              ]
            ? AbiEventParametersToPrimitiveTypes<
                readonly [...{ [K in keyof Head]: Omit<Head[K], 'name'> }],
                Options
              >
            : never)
    : // All tuple parameters are named so return as object
    {
        [Parameter in
          Filtered[number] as Parameter extends {
            name: infer Name extends string
          }
            ? Name
            : never]?: AbiEventParameterToPrimitiveType<Parameter, Options>
      } extends infer Mapped
    ? Prettify<
        MaybeRequired<
          Mapped,
          Options['Required'] extends boolean ? Options['Required'] : false
        >
      >
    : never
  : never
