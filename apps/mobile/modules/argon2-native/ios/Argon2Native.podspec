require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name = 'Argon2Native'
  s.version = package['version']
  s.summary = package['description']
  s.description = package['description']
  s.license = package['license']
  s.author = package['author']
  s.homepage = package['homepage']
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { git: 'https://www.pearlkeeper.com/argon2-native.git', tag: s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    # Vendored reference Argon2 C includes are quote-style and nested under
    # vendor/ and vendor/blake2/ — expose both so they resolve.
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/vendor" "$(PODS_TARGET_SRCROOT)/vendor/blake2"',
    # The upstream reference C compiles with benign warnings; don't let a
    # strict pod config turn them into build failures.
    'GCC_WARN_INHIBIT_ALL_WARNINGS' => 'YES'
  }

  # Swift + ObjC bridge (ios/) plus the vendored reference Argon2 C (vendor/).
  s.source_files = '*.{h,m,swift}', 'vendor/**/*.{c,h}'
  # Only the Foundation-only bridge header is public; the argon2 C headers stay
  # private to this pod.
  s.public_header_files = 'Argon2Bridge.h'
  s.preserve_paths = 'vendor/**/*'
end
