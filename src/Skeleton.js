define(function(require) {

    var Base = require("./core/Base");
    var Matrix4 = require("./math/Matrix4");

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;

    var Skeleton = Base.derive(function() {
        return {
            name : '',

            // Root joints
            roots : [],
            joints : [],

            _clips : [],

            // Matrix to joint space(inverse of indentity bone world matrix)
            _jointMatrices : [],

            // jointMatrix * currentPoseMatrix
            // worldTransform is relative to the root bone
            // still in model space not world space
            _invBindMatrices : [],

            _invBindMatricesArray : null,
            _subInvBindMatricesArray : {}
        }
    }, {

        updateHierarchy : function() {
            this.roots = [];
            var joints = this.joints;
            for (var i = 0; i < joints.length; i++) {
                var joint = joints[i];
                if (joint.parentIndex >= 0) {
                    var parent = joints[joint.parentIndex].node;
                    parent.add(joint.node);
                }else{
                    this.roots.push(joint);
                }
            }
        },

        addClip : function(clip, mapRule) {

            // Map the joint index in skeleton to joint pose index in clip
            var maps = [];
            // Create avatar
            for (var i = 0; i < clip.jointClips.length; i++) {
                for (var j = 0; j < this.joints.length; j++) {
                    var joint = this.joints[j];
                    var jointPose = clip.jointClips[i];
                    var jointName = joint.name;
                    if (mapRule) {
                        jointName = mapRule[jointName];
                    }
                    if (jointPose.name === jointName) {
                        maps[j] = i;
                        break;
                    }
                }
            }

            this._clips.push({
                maps : maps,
                clip : clip
            });
        },

        removeClip : function(clip) {
            var idx = -1;
            for (var i = 0; i < this._clips.length; i++) {
                if (this._clips[i].clip === clip) {
                    idx = i;
                    break;
                }
            }
            if (idx > 0) {
                this._clips.splice(idx, 1);
            }
        },

        getClip : function(index) {
            if (this._clips[index]) {
                return this._clips[index].clip;
            }
        },

        updateJointMatrices : function() {
            for (var i = 0; i < this.roots.length; i++) {
                // Update the transform if joint node not attached to the scene
                if (!this.roots[i].node.scene) {
                    this.roots[i].node.update();   
                }
            }
            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                this._jointMatrices[i] = (new Matrix4()).copy(joint.node.worldTransform).invert();
                this._invBindMatrices[i] = new Matrix4();
            }
        },

        update : function() {
            for (var i = 0; i < this.roots.length; i++) {
                // Update the transform if joint node not attached to the scene
                if (!this.roots[i].node.scene) {
                    this.roots[i].node.update();
                }
            }
            if (! this._invBindMatricesArray) {
                this._invBindMatricesArray = new Float32Array(this.joints.length * 16);
            }
            var cursor = 0;
            for (var i = 0; i < this.joints.length; i++) {
                var matrixCurrentPose = this.joints[i].node.worldTransform;
                this._invBindMatrices[i].copy(matrixCurrentPose).multiply(this._jointMatrices[i]);

                for (var j = 0; j < 16; j++) {
                    var array = this._invBindMatrices[i]._array;
                    this._invBindMatricesArray[cursor++] = array[j];
                }
            }
        },

        getSubInvBindMatrices : function(meshId, joints) {
            var subArray = this._subInvBindMatricesArray[meshId]
            if (!subArray) {
                subArray 
                    = this._subInvBindMatricesArray[meshId]
                    = new Float32Array(joints.length * 16);
            }
            var cursor = 0;
            for (var i = 0; i < joints.length; i++) {
                var idx = joints[i];
                for (var j = 0; j < 16; j++) {
                    subArray[cursor++] = this._invBindMatricesArray[idx * 16 + j];
                }
            }
            return subArray;
        },

        setPose : function(clipIndex) {
            var clip = this._clips[clipIndex].clip;
            var maps = this._clips[clipIndex].maps;
            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                if (maps[i] === undefined) {
                    continue;
                }
                var pose = clip.jointClips[maps[i]];

                vec3.copy(joint.node.position._array, pose.position);
                quat.copy(joint.node.rotation._array, pose.rotation);
                vec3.copy(joint.node.scale._array, pose.scale);

                joint.node.position._dirty = true;
                joint.node.rotation._dirty = true;
                joint.node.scale._dirty = true;
            }
            this.update();
        },

        blendPose : function(clip1idx, clip2idx, weight) {
            var clip1 = this._clips[clip1idx].clip;
            var clip2 = this._clips[clip2idx].clip;
            var maps1 = this._clips[clip1idx].maps;
            var maps2 = this._clips[clip2idx].maps;

            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                if (maps1[i] === undefined || maps2[i] === undefined) {
                    continue;
                }
                var pose1 = clip1.jointClips[maps1[i]];
                var pose2 = clip2.jointClips[maps2[i]];

                vec3.lerp(joint.node.position._array, pose1.position, pose2.position, weight);
                quat.slerp(joint.node.rotation._array, pose1.rotation, pose2.rotation, weight);
                vec3.lerp(joint.node.scale._array, pose1.scale, pose2.scale, weight);

                joint.node.position._dirty = true;
                joint.node.rotation._dirty = true;
                joint.node.scale._dirty = true;
            }
            
            this.update();
        },

        getBoneNumber : function() {
            return this.joints.length;
        }
    });

    return Skeleton;
})