<img align="center" src="https://github.com/Scub3d/Binging-with-Babish/blob/master/media/binging_with_babish.gif">
<br>

# Binging-with-Babish
Google Assistant app for Binging with Babish
Works for Phones and Smart Sufaces (and the simulator)

Note for storage rules: I allowed anyone to read/write to the db while I was developing it. Change for prod.

### Steps
1. Create a google cloud project
2. Setup Firestore/Firebase for the project
3. Deploy the firebase cloud functions
2. Create a dialogflow agent and link to that google cloud project (see dialogflow README)
3. Run the scripts in the scripts folder (see scripts README)
4. Zip the dialogflow folder and import it into your dialogflow project (see dialogflow README)
5. Make sure everything looks ok
7. Enable testing (see dialogflow README)
8. Test (either in the simulator or a google assistant enabled device linked to the google account your cloud project is under)
	- Simulator Link: https://console.actions.google.com/project/[your-gcloud-project-id-here]/simulator/

#### This probably wont work if you just clone my repo and try to run everything. 
1. I recommend downloading the Firebase CLI and GCloud SDK's (Always handy)
2. Create a new firebase project locally (firebase init)
3. Choose Functions, Firestore, and Storage
4. Link to the gcloud project you've created
5. Then copy all the files you need from my repo into your folder
