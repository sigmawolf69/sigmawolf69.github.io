
    var jsonStr = [
    {
    "name": "Bang Bang",
    "outline": "A chance encounter with a mysterious charmer leads to a bank employee's wild adventure.",
    "rating": 5.6,
    "director": "Siddharth Anand",
    "id": 250
    },
    {
    "name": "Bang Bang",
    "outline": "A chance encounter with a mysterious charmer leads to a bank employee's wild adventure.",
    "rating": 5.6,
    "director": "Siddharth Anand",
    "id": 250
    },
    {
    "name": "Bang Bang",
    "outline": "A chance encounter with a mysterious charmer leads to a bank employee's wild adventure.",
    "rating": 5.6,
    "director": "Siddharth Anand",
    "id": 250
    },
    {
    "name": "Indian",
    "outline": "After his daughter's tragic death, a freedom fighter steps up his war against corruption.",
    "rating": 8.4,
    "director": "Shankar",
    "id": 251
    },
    {
    "name": "Dilwale Dulhania Le Jayenge",
    "outline": "Raj and Simran meet on a trip to Europe. After some initial misadventures, they fall in love. The battle begins to win over two traditional families.",
    "rating": 8.4,
    "director": "Aditya Chopra",
    "id": 253
    }
    ];


    var jsonobj = jsonStr;
    function filterMovieDirectorData(movie,director){
        if(movie!='' && (director!='' && director!='Director')){
            var data = jsonobj.filter(function(item){
            return (item["name"].toLowerCase().indexOf(movie.toLowerCase())!=-1 && item["director"].toLowerCase().indexOf(director.toLowerCase())!=-1)
            });
        }else if(movie!='' && director=='Director'){
            var data = jsonobj.filter(function(item){
            return item["name"].toLowerCase().indexOf(movie.toLowerCase())!=-1
            });
        }else if(movie=='' && (director!='' && director!='Director')){
            var data = jsonobj.filter(function(item){
            return item["director"].toLowerCase().indexOf(director.toLowerCase())!=-1
            });
        }

    return data;
    }


    function getFilterDirectorJson(){

        var inputStr = document.getElementById("movie").value;
        var e = document.getElementById("director");
        var directorStr = e.options[e.selectedIndex].text;

        if( (inputStr=='' || inputStr=='Enter movie name') && (directorStr=='' || directorStr=='Director') ){
            alert("Please enter movie name or select director.");
            document.getElementById("filter_data_div").innerHTML="";
            document.getElementById("movie").focus();
            return false;
        }

        var filterObjs = filterMovieDirectorData(inputStr,directorStr); 
        var text="";    
        for(var i=0; i<filterObjs.length; i++){
            text+='<div id="filter_data"><div><h3>'+filterObjs[0].name+'</h3></div>';
            text+='<div>Director : '+filterObjs[0].director+'</div></div><div class="clear"></div>';
        } 
    if(filterObjs.length===0){document.getElementById("filter_data_div").innerHTML='<div id="filter_data"><div><h3>No movies found.</h3></div></div>';}else
    document.getElementById("filter_data_div").innerHTML=text;

    }

    window.onload=function(){   
    getDirectors();
    }

    function getDirectors(){
        for(var i=0; i<jsonobj.length; i++){
            //console.log(jsonobj[i].director);
            var option = document.createElement("option");
            option.text = jsonobj[i].director;
            option.value = i;
            var daySelect = document.getElementById('director');
            daySelect.appendChild(option);      
        }
    }
