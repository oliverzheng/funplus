#!/bin/bash

read -p "Enter email: " email

stty -echo
read -p "Enter password: " password
stty echo
echo

read -p "Enter your time in miliseconds (e.g. 10000 for 10 seconds): " ms
read -p "Enter your distance in km, with 2 decimal places of precision (e.g. 3.21): " km
tempfile="wakeupsheeple.xml"

echo "Logging in..."
pinline=`curl -s --header "Accept: application/json" -d "password=${password}&email=${email}" "https://api.nike.com/nsl/user/login?client_id=9dfa1aef96a54441dfaac68c4410e063&client_secret=3cbd1f1908bc1553&app=app&format=json" | grep "pin"`

if [ -z "$pinline" ]
then
	echo "Invalid login"
	exit
else
	echo "Logged in"
fi

pin=${pinline:7:36}
if [ -z "$pin" ]
then
	echo "wtf happened"
	exit
fi

datetime=`date +"%Y-%m-%dT%H:%M:%S GMT00:00"`
xml="<?xml version='1.0' encoding='ISO-8859-1'?>
<sportsData>
  <runSummary>
    <time>$datetime</time>
	<duration>$ms</duration>
    <distance unit='km'>$km</distance>
  </runSummary>
  <userInfo>
    <localSoftware version='3.4'>Nike+ iPhone</localSoftware>
    <device>iPhone4,1</device>
    <empedID>0cb942b4451d0df9516b9464cb1bf0cc0176e6f1</empedID>
  </userInfo>
  <startTime>$datetime</startTime>
</sportsData>"

echo "Creating temp upload file..."
if [ -a $tempfile ]
then
	echo "Why do you have a file called $tempfile?"
	exit
fi
echo $xml > $tempfile

echo "Uploading data..."
uploaded=`curl -s --header "pin: $pin" -F "runXML=@$tempfile;filename=runXML.xml;type=text/plain" https://secure-nikerunning.nike.com/gps/sync/plus/iphone | grep success`
rm $tempfile

if [ -z "$uploaded" ]
then
	echo "Upload failed"
	exit
else
	echo "Uploaded"
fi

echo "Syncing data..."
synced=`curl -s -d "pin=$pin" https://secure-nikerunning.nike.com/nikeplus/v1/services/device/sync_complete.jsp | grep success`
if [ -z "$synced" ]
then
	echo "Sync failed"
	exit
else
	echo "Synced"
fi

echo "Data entered successfully"
