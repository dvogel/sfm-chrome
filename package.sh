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
git clone . ../churnalism-ext-$sha1 || die "Failed to clone git repository."
cd ..
bash "$crxmake" churnalism-ext-$sha1 "$keypath"
popd >/dev/null



