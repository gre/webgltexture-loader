
set -e

for pkg in packages/*/; do
  cd $pkg
  cp ../../README.md .
  rm -rf lib
  babel --root-mode upward --source-maps -d lib src
  flow-copy-source -v src lib
  cd - 1> /dev/null
done
