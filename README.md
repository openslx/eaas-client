# EAAS client JS library
This project comprises the modified [guacamole](https://github.com/apache/incubator-guacamole-client) 0.9.5 library and the EAAS client JavaScript Library.

## How to build
To get the concatenated and minified build you simple run `mvn package` inside the project directory. The `target/eaas-client-<version>.zip` contains all distributables.

## Dependencies
The project is dependent on jQuery.

## How to run
The user should include following scripts in his HTML/HEAD:
```
/target/eaas-client-0.0.3/guacamole/guacamole.js
/target/eaas-client-0.0.3/eaas-client.js
/target/eaas-client-0.0.3/xpra/www/js/lib/aurora/aurora.js
/target/eaas-client-0.0.3/xpra/www/js/lib/jquery-3.1.1.min.js

```
Please note, that jquery version is important. *e.g. Jquery-2.2.2 would produce "Class is undefined" exception.*