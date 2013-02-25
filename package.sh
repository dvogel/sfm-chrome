#!/bin/bash

die () {
	echo $1
	exit 1
}

test "$#" -gt 1 || die "USAGE: $0 <signing key> <internal|addon-store>"
keypath=`readlink -f "$1"`
test -f "$keypath" || die "Unable to find $keypath"
test -f package.sh || die "Run $0 from your development directory."
crxmake=`readlink -f crxmake.sh`
test -f "$crxmake" || die "$crxmake not found."
which zip >/dev/null || die "No zip program found."
which git >/dev/null || die "No git program found."
pushd . >/dev/null
summline=`git show --oneline`
sha1=${summline%% *}
zipfile="churnalism-ext-${sha1}.zip"
zipfile_abs=`readlink -f "../${zipfile}"`
if [ -e "../${zipfile}" ]; then
    n=0
    while [ -e "../${zipfile}.${n}" ]; do
        n=$(($n + 1))
    done
    mv -v "../${zipfile}" "../${zipfile}.${n}"
fi
git archive --format zip --output "../${zipfile}" -9 master || die "Failed to create zip archive."
cd ..
zip -d "${zipfile}" .gitignore crxmake.sh package.sh
ls -1sh "$zipfile"
if [ "$2" == "internal" ]; then
    bash "$crxmake" "$zipfile" "$keypath"
    rm "${zipfile}"
else
    cd /tmp
    unzip -o "${zipfile_abs}" manifest.json -d /tmp
    cat < manifest.json | python -m json.tool | sed -r -e '/update_url/d' | tee manifest.json
    zip "${zipfile_abs}" manifest.json
fi
popd >/dev/null



