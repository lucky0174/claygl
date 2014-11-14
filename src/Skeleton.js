define(function(require) {

    'use strict';

    var Base = require('./core/Base');

    var glMatrix = require('glmatrix');
    var quat = glMatrix.quat;
    var vec3 = glMatrix.vec3;
    var mat4 = glMatrix.mat4;

    /**
     * @constructor qtek.Skeleton
     */
    var Skeleton = Base.derive(function() {
        return /** @lends qtek.Skeleton# */{
            /**
             * @type {string}
             */
            name : '',

            /**
             * Index of root joints
             * @type {number[]}
             */
            roots : [],

            /**
             * Index of joints
             * @type {number[]}
             */
            joints : [],

            _clips : [],

            // Matrix to joint space (relative to root joint)
            _invBindPoseMatricesArray : null,

            // Use subarray instead of copy back each time computing matrix
            // http://jsperf.com/subarray-vs-copy-for-array-transform/5
            _jointMatricesSubArrays : [],

            // jointMatrix * currentPoseMatrix
            // worldTransform is relative to the root bone
            // still in model space not world space
            _skinMatricesArray : null,

            _skinMatricesSubArrays : [],

            _subSkinMatricesArray : {}
        };
    },
    /** @lends qtek.Skeleton.prototype */
    {
        /**
         * Update joints hierarchy
         */
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

        /**
         * Add a skinning clip and create a map between clip and skeleton
         * @param {qtek.animation.SkinningClip} clip
         * @param {Object} [mapRule] Map between joint name in skeleton and joint name in clip
         */
        addClip : function(clip, mapRule) {

            // Map the joint index in skeleton to joint pose index in clip
            var maps = [];
            for (var i = 0; i < this.joints.length; i++) {
                maps[i] = -1;
            }
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

            return this._clips.length - 1;
        },

        /**
         * @param {qtek.animation.SkinningClip} clip
         */
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
        /**
         * Remove all clips
         */
        removeClipsAll : function() {
            this._clips = [];
        },

        /**
         * Get clip by index
         * @param  {number} index
         */
        getClip : function(index) {
            if (this._clips[index]) {
                return this._clips[index].clip;
            }
        },

        /**
         * @return {number}
         */
        getClipNumber : function() {
            return this._clips.length;
        },

        /**
         * Calculate joint matrices from node transform
         * @method
         */
        updateJointMatrices : (function() {

            var m4 = mat4.create();

            return function() {
                for (var i = 0; i < this.roots.length; i++) {
                    this.roots[i].node.update(true);
                }
                this._invBindPoseMatricesArray = new Float32Array(this.joints.length * 16);
                this._skinMatricesArray = new Float32Array(this.joints.length * 16);

                for (var i = 0; i < this.joints.length; i++) {
                    var joint = this.joints[i];
                    // Joint space is relative to root joint's parent, if have
                    // !!Parent node and joint node must all be updated
                    if (joint.rootNode && joint.rootNode.getParent()) {
                        mat4.invert(m4, joint.rootNode.getParent().worldTransform._array);
                        mat4.multiply(
                            m4,
                            m4,
                            joint.node.worldTransform._array
                        );   
                        mat4.invert(m4, m4);
                    } else {
                        mat4.copy(m4, joint.node.worldTransform._array);
                        mat4.invert(m4, m4);
                    }

                    var offset = i * 16;
                    for (var j = 0; j < 16; j++) {
                        this._invBindPoseMatricesArray[offset + j] = m4[j];
                    }
                }

                this.updateMatricesSubArrays();
            };
        })(),

        updateMatricesSubArrays : function() {
            for (var i = 0; i < this.joints.length; i++) {
                this._jointMatricesSubArrays[i] = this._invBindPoseMatricesArray.subarray(i * 16, (i+1) * 16);
                this._skinMatricesSubArrays[i] = this._skinMatricesArray.subarray(i * 16, (i+1) * 16);
            }
        },

        /**
         * Update skinning matrices
         */
        update : (function() {
            var m4 = mat4.create();
            return function() {
                for (var i = 0; i < this.roots.length; i++) {
                    this.roots[i].node.update(true);
                }

                for (var i = 0; i < this.joints.length; i++) {
                    var joint = this.joints[i];
                    mat4.multiply(
                        this._skinMatricesSubArrays[i],
                        joint.node.worldTransform._array,
                        this._jointMatricesSubArrays[i]
                    );

                    // Joint space is relative to root joint's parent, if have
                    // PENDING
                    if (joint.rootNode && joint.rootNode.getParent()) {
                        mat4.invert(m4, joint.rootNode.getParent().worldTransform._array);
                        mat4.multiply(
                            this._skinMatricesSubArrays[i],
                            m4,
                            this._skinMatricesSubArrays[i]
                        );
                    }
                }
            };
        })(),

        getSubSkinMatrices : function(meshId, joints) {
            var subArray = this._subSkinMatricesArray[meshId];
            if (!subArray) {
                subArray 
                    = this._subSkinMatricesArray[meshId]
                    = new Float32Array(joints.length * 16);
            }
            var cursor = 0;
            for (var i = 0; i < joints.length; i++) {
                var idx = joints[i];
                for (var j = 0; j < 16; j++) {
                    subArray[cursor++] = this._skinMatricesArray[idx * 16 + j];
                }
            }
            return subArray;
        },

        /**
         * Set pose and update skinning matrices
         * @param {number} clipIndex
         */
        setPose : function(clipIndex) {
            var clip = this._clips[clipIndex].clip;
            var maps = this._clips[clipIndex].maps;

            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                if (maps[i] === -1) {
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
        }
    });

    return Skeleton;
});