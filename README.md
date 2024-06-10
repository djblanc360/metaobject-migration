# Metaobject Migration

Incomplete internal tool for migrating metaobjects and their definitions.

Still in development, currently unable to handle metaobjects that are referencing fields that don't exist in target store.

## Description

An in-depth paragraph about your project and overview of use.

## Getting Started

### Dependencies

* 

### Installing

1. Install dependencies on local environment
```
npm install
```

2. Ensure node version is a tleast 20
```
node -v
nvm use v20
```

### Executing program

1.
select action by chooing a index file
    - save a store's metaobjects and their definitions : index-READ-DEFINITIONS.js
    - write saved metaobject definitions to a store : index-WRITE-DEFINITIONS.js
    - write saved metaobject to a store : index-WRITE-METAOBJECTS.js

2.
run the following command in terminal
```
node index.js
```
### Deploying


## Debugging Locally


## Debugging


## Help

Any advise for common problems or issues.
```
command to run if program contains helper info
```

## Potential Future Updates
* features to be added or desired

## Authors

* [@Daryl Blancaflor](djblanc360@gmail.com)

## Version History

* 0.1
    * store metaobject definitions from one store and add to the other
    * can copy over metaobjects that don't have references


## License

This project is licensed under the [NAME HERE] License - see the LICENSE.md file for details

## Acknowledgments

Inspiration, code snippets, etc.