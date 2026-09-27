# Vendored libraries

`trystero-firebase.js` is `@trystero-p2p/firebase` 0.25.4 with the Firebase JS SDK bundled in as one ES module, so online play needs no CDN and works with the offline cache. To rebuild it:

```sh
npm i --no-save @trystero-p2p/firebase@0.25.4 esbuild
echo "export { joinRoom, selfId } from '@trystero-p2p/firebase';" > /tmp/entry.js
npx esbuild /tmp/entry.js --bundle --format=esm --minify --target=es2020 --legal-comments=eof --outfile=js/vendor/trystero-firebase.js
```

It is only downloaded when a player opens the online lobby.
