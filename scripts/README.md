#### Setup
1. Create a google cloud project then navigate to firebase and setup firestore for the gcloud project
2. Go to the project settings for the firebase project and click on the "Service accounts" tab
3. Generate a new private key and save it as credentials.json
4. Okay, so idk why Google does this, but they've removed (for me at least) the developer key thing from dialowflow and replaced it with a service account instead. Which is whatever, but I tried the new way of using they're api and trying the dialowflow package instead of using requests to PUT my data, but I cannot figure it out so you're on your own if you want to recreate this. I'm just using the old way since the dev key still works for some reason.
5. If you have a dialogflow developer key, get it and add it to the file below

6. Create a secrets.py file and add two functions:
	```
	def dialogflow_secret():
		return "<your dialogflow developer key here>"

	def gcloud_project_id():
		return "<your google cloud project id here>"
	```

#### Scripts
1. Run get_recipe_urls.py
2. Run process_recipes.py
3. If it errors out multiple times on a url, it means it probably has a format the code can't handle. Put a '-' at the start of the line like the '+' ('-' = couldn't process, '+' = processed)
4. Re-run if squarespace serves us bad pages. Could take multiple (5+ runs)
5. Run create_dialogflow_entities.py
6. Check it out on dialogflow and firebase