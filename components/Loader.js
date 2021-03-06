let Loader = function( container, id ) {

    this.innerContainer = document.createElement( 'a-entity' );
    this.innerContainer.setAttribute('id', id);
    container.appendChild(this.innerContainer);

    // For trajectory only
    this.traObjectsContainer = document.createElement( 'a-entity' );

}

Loader.prototype = {

    loadCSV: function ( path, id) {
        let that = this;

        return new Promise((resolve, reject) => {
            Papa.parse(path, {
                header: true,
                download: true,
                dynamicTyping: true,
                complete: function(results) {
                    let data = results.data;
                    if (id === 'cellData') {
                        that.renderPoints(data);
                        globalData.cellData = data;
                    } else if (id === 'trajectory') {
                        that.renderTrajectory(data)
                        globalData.trajectoryData = data;
                    }
                    resolve(results.data)
                },
                error: function (err) {
                    reject(err)
                }
            })
        })
    },

    renderPoints: function( data, flag = false ){
        globalData.categoricalColorDict = {};
        let attributesList = Object.keys(data[0]);
        const idStr = attributesList[0];
        const featureList = attributesList.splice(4, attributesList.length - 4);
        globalData.markerGeneList = featureList;
        let curMarkerGene = '';
        if (flag) {
            console.log('Reloading starts');
            curMarkerGene = globalData.curMarkerGene.MarkerGene;
            let oldCellData = document.getElementById('cellData');
            oldCellData.innerHTML = '';
        } else {
            curMarkerGene = featureList[0];
            globalData.curMarkerGene.MarkerGene = curMarkerGene;
        }
        console.log('Current MarkerGene: ', curMarkerGene);
        // deal with non-numerical attributes
        let isStr = false;
        let strSet = [];
        let strToNumDict = {};
        let strToNumIndex = 0;
        if (typeof(data[0][curMarkerGene]) === 'string') {
            console.log('this gene marker contains strings');
            isStr = true;
            // have a different colormap info block
            document.getElementById('colormapToastBody').setAttribute('style', 'display: none');
        } else {
            document.getElementById('colormapToastBody').setAttribute('style', 'display: block');
        }
        let edgeValue = 0;
        let featureMax = 0;
        for (let i = 0; i < data.length; i++) {
            if (Math.abs(data[i].x) > edgeValue) {
                edgeValue = Math.abs(data[i].x);
            }
            if (Math.abs(data[i].y) > edgeValue) {
                edgeValue = Math.abs(data[i].y);
            }
            if (Math.abs(data[i].z) > edgeValue) {
                edgeValue = Math.abs(data[i].z);
            }
            if (isStr) {
                if ( !strSet.includes(data[i][curMarkerGene]) && data[i][curMarkerGene] ){
                    strSet.push(data[i][curMarkerGene]);
                    strToNumDict[data[i][curMarkerGene]] = strToNumIndex;
                    strToNumIndex = strToNumIndex + 1;
                }
                featureMax = strToNumIndex;
            } else {
                if (data[i][curMarkerGene] > featureMax) {
                    featureMax = data[i][curMarkerGene];
                }
            }
        }
        globalData.featureMAX = featureMax;
        document.getElementById('colormapMAX').innerText = "MAX: " + globalData.featureMAX.toFixed(2);
        console.log('max value: ', globalData.featureMAX);
        globalData.scaleUp = 150/edgeValue;
        globalData.scaleDown = 1/edgeValue;
        const featureNorm = 100/featureMax;
        data.forEach(element => {
            let colorIndex;
            if (isStr) {
                colorIndex = strToNumDict[element[curMarkerGene]] * featureNorm;
            } else {
                colorIndex = element[curMarkerGene] * featureNorm;
            }
            if (Math.round(colorIndex) > 99) {colorIndex = 99}
            const colorStr = globalData.batlowColormap[Math.round(colorIndex)];
            let aSphere = document.createElement('a-sphere');
            aSphere.setAttribute('id', element[idStr]);
            if (colorStr) {
                aSphere.setAttribute('color', colorStr);
                if (isStr) {
                    globalData.categoricalColorDict[element[curMarkerGene]] = colorStr;
                }
            }
            aSphere.setAttribute('radius', '0.6');
            aSphere.setAttribute('position', element.x*globalData.scaleUp + ' ' + element.y*globalData.scaleUp + ' ' + element.z*globalData.scaleUp)
            this.innerContainer.appendChild(aSphere);
        });
        $(document).ready(function() {
            // After rerendering, hide the spinner
            console.log('Reloading ends');
            document.getElementById('theSpinner').style.height = '0';
            document.getElementById('theSpinner').style.visibility = 'hidden';
            // Change colormap information to category
            if (isStr) {
               let colormapSection = document.getElementById('colormapToastBodyCategory');
               colormapSection.innerHTML = '';
                Object.keys(globalData.categoricalColorDict).forEach(function(key) {
                    let row = document.createElement('p');
                    row.innerHTML = key;
                    row.setAttribute('style', 'color: white; background-color: '+globalData.categoricalColorDict[key]);
                    row.setAttribute('class', 'ps-3');
                    colormapSection.appendChild(row);
                });
                colormapSection.setAttribute('style', 'display: block; max-height: 200px; overflow-y: scroll');
            } else {
                document.getElementById('colormapToastBodyCategory').innerHTML = '';
                document.getElementById('colormapToastBodyCategory').setAttribute('style', 'display: none');
            }
        });
    },

    renderTrajectory: function ( data ) {
        data.forEach(element => {
            let color = '#943126';
            let radius = '0.15';
            // Root has distinct color and radius.
            if (element.root) {
                color = '#F39C12'
                radius = '0.4';
                globalData.destinationCheckpoint = {x:element.x*globalData.scaleUp, y:element.y*globalData.scaleUp, z:element.z*globalData.scaleUp};
            }
            let aSphere = document.createElement('a-sphere');
            aSphere.setAttribute('id', element.edges);
            aSphere.setAttribute('color', color);
            aSphere.setAttribute('radius', radius);
            const x = element.x*globalData.scaleUp;
            const y = element.y*globalData.scaleUp;
            const z = element.z*globalData.scaleUp;
            aSphere.setAttribute('position', x + ' ' + y+ ' ' + z)
            this.traObjectsContainer.appendChild(aSphere);

            if (element.children) {
                let childrenList = element.children.split(",");
                const startPoint = x + ', ' + y + ', ' + z;
                childrenList.forEach(
                    element2 => {
                        let path = document.createElement('a-entity');
                        const object = this.getObjectFromID(data, element2);
                        const x_e = object.x*globalData.scaleUp;
                        const y_e = object.y*globalData.scaleUp;
                        const z_e = object.z*globalData.scaleUp;
                        const endPoint = x_e + ', ' + y_e + ', ' + z_e;

                        // path.setAttribute('meshline','path: ' + startPoint + ', ' + endPoint + ' ; color: #566573; lineWidth: 7');
                        path.setAttribute('line', 'start: '+startPoint+'; end: '+endPoint+'; color: #943126');

                        this.innerContainer.appendChild(path);

                        if (childrenList.length > 0) {
                            const x_e_half = (x+x_e)/2;
                            const y_e_half = (y+y_e)/2;
                            const z_e_half = (z+z_e)/2;
                            let directionChoice = this.addDirection((x+x_e_half)/2,(y+y_e_half)/2,(z+z_e_half)/2,  new THREE.Vector3(x_e, y_e, z_e), element.edges+'-'+element2);
                            // this.innerContainer.appendChild(directionChoice);
                            this.traObjectsContainer.appendChild(directionChoice);
                        }
                    }
                )
            }

        })

        this.innerContainer.appendChild(this.traObjectsContainer);
    },

    getObjectFromID : function( data, id ) {
        let result = null;
        data.forEach(element => {
            const idStr = Object.keys(data[0])[0];
            if (element[idStr] === id) {
                result = element
            }
        });
        return result
    },

    addDirection : function(x, y, z, destination, name) {
        let objectWrapper = document.createElement('a-entity');
        let object = document.createElement('a-cone');
        object.setAttribute('color', '#943126');
        object.setAttribute('radius-bottom', '0.15');
        object.setAttribute('radius-top', '0');
        object.setAttribute('height', '1.2');
        objectWrapper.setAttribute('position', x+' '+y+' '+z);
        object.setAttribute('rotation', '90 0 0');

        object.setAttribute('clickhandler', "txt:"+destination.x+' '+destination.y+' '+destination.z);
        object.setAttribute('data-raycastable');

        objectWrapper.appendChild(object);
        objectWrapper.setAttribute('look-at', destination);
        return objectWrapper
    },

    registerComp : function () {
        let that = this;
        AFRAME.registerComponent('clickhandler', {
            schema: {
                txt: {default:'default'}
            },
            init: function () {
                let data = this.data;
                let el = this.el;
                el.addEventListener('click', function () {
                    const desList = data.txt.split(' ');
                    globalData.destinationCheckpoint = {x: desList[0], y: desList[1], z: desList[2]};
                    console.log('new destination: ', globalData.destinationCheckpoint);
                    movementController.move(camera, container, globalData.destinationCheckpoint);

                    // invisualize the spheres and cones in the trajectory system when the movement starts
                    that.traObjectsContainer.setAttribute('visible', 'false');
                    setTimeout(function (){
                        that.traObjectsContainer.setAttribute('visible', 'true');
                    }, movementController.positionAnimationDur)

                });
            }
        });
    },
}