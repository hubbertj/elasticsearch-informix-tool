# Elasticsearch-informix-tool
Creates, updates a elasticsearch index.
Process:
	Pulls all records from the informix data defined in your properties file.
	Depending on your arguments, it will either create or update a index.
	Pulls from the output/FilterDataList.json and makes the correct rest call to the elk server.

## Installation
install node & npm

$> npm install  
$> node elasticsearchTool  

	$> elasticsearch-informix-tool --help
	Usage: elasticsearchTool [options] <file>

  Options:

  -f, &ensp; --force &ensp; *indexName* &ensp; Use if you want to specify the index. And want to skip the data gather process.  
  -c, &ensp; --create &ensp; *indexName* &ensp; When used this will create a new index and insert the new documents  
  -u, &ensp; --update &ensp; *indexName* &ensp; When used this will try to update the index and insert the new documents.  
  -h, &ensp; --help &ensp; output usage information  


## How to use the elasticsearch-informix-tool
    
    $> node elasticsearch-informix-tool -c searchable  

This will pull json from the informix database, then create a index called `searchable`  
Then inject documents from the json file into your new index `searchable`.
  
## Notes
All configuration are located in the config/application.properties file
When the applicaiton runs the _data_ingress.jar it creates a output folder with FilterDataList.json and RawDataList.json
RawDataList.json is before the merge is applied.

If you have a issue with herp size you make need to run node like this  

    $> node --max-old-space-size=4096 elasticsearch-informix-tool --create `indexName` 

