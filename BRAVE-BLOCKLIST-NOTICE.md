# Site blocklist notice

The generated site-level network blocklist in `src/generated/brave-site-blocklist.json`
is derived from the Brave Software `brave/adblock-lists` repository:

https://github.com/brave/adblock-lists/tree/master/brave-lists

The upstream material is licensed under the Mozilla Public License 2.0:

https://github.com/brave/adblock-lists/blob/master/LICENSE

The same generated file also includes supported network rules from EasyList:

https://easylist.to/easylist/easylist.txt

EasyList is distributed under GPL-3.0-or-later and Creative Commons
Attribution-ShareAlike 3.0 terms. See its upstream repository for the current
license and source notices:

https://github.com/easylist/easylist

Run `npm run update:brave-blocklist` to download the current upstream lists and
rebuild the local JSON file. Duplicate rules are removed automatically. Only host and URL-prefix network rules that
a normal webpage can enforce are generated. Browser-only cosmetic, scriptlet,
redirect, CNAME, debounce, and URL-cleaning behavior is intentionally excluded.

Google Tag Manager, Google Analytics, Cloudflare services, and the `nhplayer.com`
player host listed in
`src/network-blocker-config.json` are always allowed and are removed from the
generated blocked rules.
