#!/bin/bash

die () {
	echo $1
	exit 1
}

test "$#" -gt 0 || die "USAGE: $0 <signing key>"
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
n=0
while [ -e "../${zipfile}.${n}" ]; do
    n=$(($n + 1))
done
mv -v "../${zipfile}" "../${zipfile}.${n}"
git archive --format zip --output "../${zipfile}" -9 master || die "Failed to create zip archive."
cd ..
zip -d "${zipfile}" .gitignore crxmake.sh package.sh
ls -1sh "$zipfile"
bash "$crxmake" "$zipfile" "$keypath"
rm "${zipfile}"
popd >/dev/null



