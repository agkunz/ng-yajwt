(function ()
{
    'use strict';

    angular
        .module('ngYajwt', [])
        .service('jwtHelper', jwtHelper)
        .provider('jwtIntercept', [jwtInterceptor]);

    function jwtInterceptor ()
    {
        var vm = this;

        vm.useRefreshTokens = false;

        vm.setToken = defaultSetToken;
        vm.getToken = defaultGetToken;

        vm.forbidden = unconfigured;
        vm.unauthorized = unconfigured;

        vm.refreshToken = vm.useRefreshTokens ? unconfigured : null;

        function unconfigured ()
        {
            console.log ("You should set up a callback for this case in your configuration file.");
            return false;
        }

        function defaultSetToken (token)
        {
            if (typeof(Storage) !== "undefined") {

                localStorage.setItem('ngYajwtToken', token);

            } else {

                document.cookie = "ngYajwtToken=" + token;

            }
        }

        function defaultGetToken (token)
        {
            if (typeof(Storage) !== "undefined") {

                return localStorage.getItem('ngYajwtToken');
            
            } else {
                var cookies = document.cookie.split(';');
                
                for (var key in cookies) {
                    var cookie = cookies[key].split('=');

                    if (cookie[0] === 'ngYajwtToken')
                        return cookie[1];
                }
            }
        }

        this.$get = ['$q', '$injector', '$rootScope', 'jwtHelper', Interceptor];
        function Interceptor ($q, $injector, $rootScope, jwtHelper)
        {
            return {
                request: request,
                response : response,
                responseError : fail
            };

            function request (request)
            {
                // if auth is explicityly false, just bail
                if (request.auth === false) { return request; }
                // if refresh is explicity true, let it through
                if (request.refresh === true) { return request; }

                // if we think this is for a template, bail
                if (request.url.substr(request.url.length - 5) == '.html') {
                    return request;
                }
                
                // fire the supplied get token method
                var token = $injector.invoke(vm.getToken, vm);

                // if we didn't get one, just fire the request anyway
                if (!token) // it'll probably fail
                    return request; // but that's what the fail catch is for

                // this is just some handy info gathered by angular-jwt's service provider
                var decode = {      // didn't want to rip just the provider out so included it
                    // k i ended up ripping it to make this package stand alone, source included below
                    expired : jwtHelper.isTokenExpired(token),
                    expiry : jwtHelper.getTokenExpirationDate(token),
                    data : jwtHelper.decodeToken(token),
                }

                // if our token is expired, and we aren't already doing a refresh
                if (decode.expired) {
                    // if we're using refresh tokens
                    if (vm.useRefreshTokens && !isRefresh(request)) {
                        // grab a new token and then try the request again
                        return refresh(request);
                    } else {
                        // otherwise just attach the expired token and we'll probably get a 401
                        return attachHeader(request, token);
                    }
                } else {
                    // add the token to the request and send
                    return attachHeader(request, token);
                }

                function isRefresh (request) { return (request.data && request.data.refresh); }
            }

            // our token is expired, try to get a new one before continuing
            function refresh (request)
            {
                // fire the supplied refresh mechanism
                return $injector.invoke(vm.refreshToken, vm)
                    // then fire the original request
                    .then(refreshed);

                // when the refresh is done
                function refreshed (r2)
                {   // attach the new auth header to the old request
                    return attachHeader(request, r2.headers().authorization);
                }
            }

            // attach a token to the headers of a request
            function attachHeader (request, token)
            {
                request.headers = request.headers || {};

                request.headers.authorization = token;
                
                return request;
            }

            // watch every response
            function response (response)
            {   // for an auth token
                var token = response.headers().authorization;
                // and if you find one
                if (token) {    // assume it's for us
                    // fire the supplied set token method to save it
                    $injector.invoke(vm.setToken, vm, { token : token });
                }
                // return the unadulterated response
                return response;
            }

            // watch failed requests
            function fail (response)
            {   
                // if auth wasn't set on the request
                if (response.config && response.config.auth == false) {
                    // it wasn't us, so just reject
                    return $q.reject(response);
                }
                // if we get a 401, we did a refresh and was declined
                if (response.status == 401) {
                    // so log them out
                    $injector.invoke(vm.unauthorized, vm, {});
                }
                // if we get a 403, we were just declined access to a specific resource
                if (response.status == 403) {
                    $injector.invoke(vm.forbidden, vm, {});
                }
                // return the failed response
                return $q.reject(response);
            }
        }
    }

    // ripped this from https://github.com/auth0/angular-jwt
    function jwtHelper ()
    {
        this.urlBase64Decode = function (str)
        {
          var output = str.replace(/-/g, '+').replace(/_/g, '/');
          switch (output.length % 4) {
            case 0: { break; }
            case 2: { output += '=='; break; }
            case 3: { output += '='; break; }
            default: {
              throw 'Illegal base64url string!';
            }
          }
          return decodeURIComponent(escape(window.atob(output))); //polifyll https://github.com/davidchambers/Base64.js
        }

        this.decodeToken = function (token)
        {
          var parts = token.split('.');

          if (parts.length !== 3) {
            throw new Error('JWT must have 3 parts');
          }

          var decoded = this.urlBase64Decode(parts[1]);

          if (!decoded) {
            throw new Error('Cannot decode the token');
          }

          return JSON.parse(decoded);
        }

        this.getTokenExpirationDate = function (token)
        {
          var decoded;
          decoded = this.decodeToken(token);

          if(typeof decoded.exp === "undefined") {
            return null;
          }

          var d = new Date(0); // The 0 here is the key, which sets the date to the epoch
          d.setUTCSeconds(decoded.exp);

          return d;
        };

        this.isTokenExpired = function (token, offsetSeconds)
        {
          var d = this.getTokenExpirationDate(token);
          offsetSeconds = offsetSeconds || 0;
          if (d === null) {
            return false;
          }

          // Token expired?
          return !(d.valueOf() > (new Date().valueOf() + (offsetSeconds * 1000)));
        };

        return this;
    }

})();