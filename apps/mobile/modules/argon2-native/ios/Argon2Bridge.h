#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/// Thin Objective-C wrapper over the vendored reference Argon2 C implementation.
/// Kept free of any argon2.h types so it can be a public header consumable by
/// the module's Swift code via the pod's generated umbrella.
@interface Argon2Bridge : NSObject

/// Computes a raw Argon2id (type id, version 0x13) hash and returns lowercase
/// hex, or nil + populated `error` on failure. Byte-identical to
/// @noble/hashes argon2id for the same inputs.
+ (nullable NSString *)argon2idRawHexWithPassword:(NSString *)password
                                          saltHex:(NSString *)saltHex
                                                t:(int)t
                                             mKiB:(int)mKiB
                                                p:(int)p
                                            dkLen:(int)dkLen
                                            error:(NSError **)error;

@end

NS_ASSUME_NONNULL_END
