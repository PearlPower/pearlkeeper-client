#import "Argon2Bridge.h"
#import "argon2.h"

static NSData *_Nullable hexToData(NSString *hex) {
  if (hex.length % 2 != 0) {
    return nil;
  }
  NSUInteger len = hex.length / 2;
  NSMutableData *data = [NSMutableData dataWithLength:len];
  uint8_t *bytes = (uint8_t *)data.mutableBytes;
  for (NSUInteger i = 0; i < len; i++) {
    unichar hi = [hex characterAtIndex:2 * i];
    unichar lo = [hex characterAtIndex:2 * i + 1];
    int hiV = (hi >= '0' && hi <= '9') ? hi - '0'
            : (hi >= 'a' && hi <= 'f') ? hi - 'a' + 10
            : (hi >= 'A' && hi <= 'F') ? hi - 'A' + 10 : -1;
    int loV = (lo >= '0' && lo <= '9') ? lo - '0'
            : (lo >= 'a' && lo <= 'f') ? lo - 'a' + 10
            : (lo >= 'A' && lo <= 'F') ? lo - 'A' + 10 : -1;
    if (hiV < 0 || loV < 0) {
      return nil;
    }
    bytes[i] = (uint8_t)((hiV << 4) | loV);
  }
  return data;
}

@implementation Argon2Bridge

+ (nullable NSString *)argon2idRawHexWithPassword:(NSString *)password
                                          saltHex:(NSString *)saltHex
                                                t:(int)t
                                             mKiB:(int)mKiB
                                                p:(int)p
                                            dkLen:(int)dkLen
                                            error:(NSError **)error {
  NSData *salt = hexToData(saltHex);
  if (salt == nil) {
    if (error) {
      *error = [NSError errorWithDomain:@"Argon2Native"
                                   code:1
                               userInfo:@{NSLocalizedDescriptionKey : @"Salt is not valid hex"}];
    }
    return nil;
  }

  NSData *pwd = [password dataUsingEncoding:NSUTF8StringEncoding];
  if (pwd == nil) {
    if (error) {
      *error = [NSError errorWithDomain:@"Argon2Native"
                                   code:2
                               userInfo:@{NSLocalizedDescriptionKey : @"Password is not valid UTF-8"}];
    }
    return nil;
  }
  NSMutableData *out = [NSMutableData dataWithLength:(NSUInteger)dkLen];

  int rc = argon2id_hash_raw((uint32_t)t,
                             (uint32_t)mKiB,
                             (uint32_t)p,
                             pwd.bytes,
                             pwd.length,
                             salt.bytes,
                             salt.length,
                             out.mutableBytes,
                             (size_t)dkLen);

  if (rc != ARGON2_OK) {
    if (error) {
      *error = [NSError errorWithDomain:@"Argon2Native"
                                   code:rc
                               userInfo:@{NSLocalizedDescriptionKey : [NSString stringWithUTF8String:argon2_error_message(rc)]}];
    }
    return nil;
  }

  const uint8_t *hb = (const uint8_t *)out.bytes;
  static const char hexChars[] = "0123456789abcdef";
  NSMutableString *hex = [NSMutableString stringWithCapacity:(NSUInteger)dkLen * 2];
  for (int i = 0; i < dkLen; i++) {
    [hex appendFormat:@"%c%c", hexChars[hb[i] >> 4], hexChars[hb[i] & 0x0F]];
  }
  return hex;
}

@end
