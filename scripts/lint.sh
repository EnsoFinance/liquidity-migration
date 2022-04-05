#!/usr/bin/env bash

yarn prettier --write '**/*.{js,json,sol,ts}'

# TODO: fix errors

# yarn solhint --max-warnings 0 --fix 'contracts/**/*.sol'

# eslint --fix --ext .js,.ts .

