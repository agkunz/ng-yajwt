# Yet Another JWT Handler

## Introduction

Inspired by angular-jwt, something with just a little more control.

## Installation

Install with bower:
````bash
bower install ng-yajwt --save
````

## Configuration


At the very minimum, you should define what happens when your token is rejected.

````js
angular.module('app', ['ngYajwt'])
    .config(jwt);

jwt.$inject = ['$httpProvider', 'jwtInterceptProvider'];
function jwt ($httpProvider, jwtInterceptProvider)
{
    jwtInterceptProvider.unauthorized = ['Auth', 'logger', '$state', unauthorized];
    function unauthorized (Auth, logger, $state)
    {
        logger.error ('Your session has expired.');

        Auth.logout();
        
        return $state.go ('home');
    }
    
    jwtInterceptProvider.forbidden = ['logger', '$state', forbidden];
    function forbidden (Auth, logger, $state)
    {
        logger.error ('You\'re not allowed to do that!');

        return $state.go ('profile');
    }

    $httpProvider.interceptors.push('jwtIntercept');
}
````

If you'd like to automatically refresh an expired token, just tell us how to go about doing it.

````js
jwtInterceptProvider.useRefreshTokens = true;

jwtInterceptProvider.refreshToken = ['Auth', refreshToken];
function refreshToken (Auth)
{
    console.log ('Refreshing your login token...');

    return Auth.refreshToken();
}
````

By default, if localStorage is available we'll store the token there.  If not, we'll store it in the cookie.
If you want to control how we store the token, just supply a getter and a setter.

````js
jwtInterceptProvider.getToken = ['Auth', getToken];
function getToken (Auth)
{
    var token = Auth.getToken();

    console.log ('using ' + token.slice(-10));
    
    return token;
}

// the token will be injected here for you to save wherever you want
jwtInterceptProvider.setToken = ['Auth', 'token', setToken];
function setToken (Auth, token)
{
    console.log ('setting ' + token.slice(-10));
    
    // i personally inject gsklee/ngStorage into my auth service and store it there
    return Auth.setToken(token);
}
````

## Usage

This package will watch all responses for an Authorization header, and assume that to be the next token we pass.

If you don't need to pass a token on certain requests, just say so.

````js
return $http.get('/public/route', { auth : false });
````

If you're using refresh tokens, we need to know which route you use to do it.

````js
return $http.post('/auth/refresh', { refresh : true });
````