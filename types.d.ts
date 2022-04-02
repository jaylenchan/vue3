declare type Expand<T extends Record<any, any>> = T extends infer U
  ? {
      [key in keyof U]: U[key]
    }
  : never

declare type ResolveReturnType<T extends (...args: any[]) => any> = T extends (
  ...args: any[]
) => infer U
  ? U
  : never
