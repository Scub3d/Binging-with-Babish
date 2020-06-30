### Steps
1. Create a new dialogflow agent
2. Link it to the gcloud project you want
3. Go into agent.json and put your gcloud project id where it says to
4. Zip up the dialogflow folder
5. BEFORE YOU CONTINUE, MAKE SURE YOU UPLOAD THE ENTITY DATA TO THE AGENT, OR IT COULD BREAK (basically run all the scripts in the scripts folder) (see scripts README)
6. In the dialogflow agent settings, click the "Export and Import" tab
7. "IMPORT FROM ZIP"
8. Under the Fulfillment tab, enable webhook and disable the Inline Editor (if enabled)
9. Go to: https://console.firebase.google.com/project/\<your-gcloud-project-id-here\>/functions/list, get the url for the function listed, and paste it into the url slot on the webhook form on dialogflow. 
	- Mine was: https://us-central1-\<my-project-id\>.cloudfunctions.net/dialogflowFirebaseFulfillment (the last bit is just what I named it in the Firebase Cloud Function)
10. Under the integrations tab, find the google assistant box and click "INTEGRATION SETTINGS"
11. Enable auto preview changes and click "TEST"
12. You can now test your agent on the actions on google simulator and your google assistant enabled devices (phones, screens, etc)