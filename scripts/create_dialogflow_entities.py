# -*- coding: utf-8 -*-

import firebase_admin, sys, os, re, requests, json
from firebase_admin import credentials, firestore, storage
from secrets import gcloud_project_id, dialogflow_secret

recipes_json_file = "Recipes.json" # the entity on dialogflow is named Recipes, I wanted the file contents that are uploaded to have the same name

dialogflow_url = 'https://api.dialogflow.com/v1/entities?v=20150910' # v1 is 'deprecated' but still works

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = "credentials.json"

cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
  'projectId': gcloud_project_id(), 
})

db = firestore.client()

def get_recipes_data(): # get all of the recipe documents from firestore and add titles to a list
	recipes = db.collection('recipes').stream()
	data = []
	for recipe in recipes:
		data.append(recipe.to_dict()["title"])
	return data

def create_recipes_json(): # create a json file that can be uploaded to dialogflow
	recipes = get_recipes_data()

	file = open(recipes_json_file, "w")

	file.write('{\n')
	file.write('	"isRegexp": false,\n')
	file.write('	"isEnum": false,\n')
	file.write('	"allowFuzzyExtraction": true,\n')
	file.write('	"name": "Recipes",\n') # <---- name of the entity in dialogflow
	file.write('	"automatedExpansion": true,\n')
	file.write('	"entries": [\n')

	# Special characters/unicode break inside dialogflow. Find a fix
	for recipeIndex in range(0, len(recipes)):
		recipe = re.sub(r' \([^)]*\)', '', recipes[recipeIndex])
		file.write('		{\n')
		file.write('			"value": "' + recipe + '",\n')
		file.write('			"synonyms": [\n') # We want some synonyms for each recipe

		if " inspired by " in recipe: # so if the title contains "inspired by" we can split the string on it and take both halves to make some synonyms
			file.write('				"' + recipe + '",\n')

			# Ignore the one recipes that says: inspired by YOU. We don't want YOU to be a entity synonym
			if recipe.split(" inspired by ")[1] != "YOU":
				file.write('				"' + recipe.split(" inspired by ")[0] + '",\n')
				file.write('				"' + recipe.split(" inspired by ")[1] + '"\n')
			else:
				file.write('				"' + recipe.split(" inspired by ")[0] + '"\n')
		else:
			file.write('				"' + recipe + '"\n')

		file.write('		 	 ]\n')

		if recipeIndex == len(recipes) - 1:
			file.write('		}\n')
		else:
			file.write('		},\n')
	file.write('	]\n')
	file.write('}\n')

def upload():
	file = open(recipes_json_file)
	data = json.load(file)

	headers = { # Auth
		'Content-Type': 'application/json',
		'Authorization': 'Bearer {}'.format(dialogflow_secret())
	}

	r = requests.request('PUT', dialogflow_url, headers=headers, data=json.dumps(data)) # upload the data to dialogflow

	print(r.text) # let's us know whether it worked or not

	file.close()

if __name__ == "__main__":
	create_recipes_json()
	upload()