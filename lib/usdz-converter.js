import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js';
import fetch from 'node-fetch';

/**
 * Converts GLB file to USDZ with proper scaling for iOS AR
 */
export class USDZConverter {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.usdzExporter = new USDZExporter();
    }

    /**
     * Convert GLB to USDZ with dimension-based scaling
     * @param {string} glbUrl - URL to the GLB file
     * @param {Object} dimensions - Target dimensions in meters
     * @param {number} dimensions.width_meters - Width in meters
     * @param {number} dimensions.height_meters - Height in meters  
     * @param {number} dimensions.depth_meters - Depth in meters
     * @returns {Promise<ArrayBuffer>} - USDZ file as ArrayBuffer
     */
    async convertGLBToUSDZ(glbUrl, dimensions = null) {
        try {
            console.log('🔄 Converting GLB to USDZ:', glbUrl);
            
            // Fetch the GLB file
            const response = await fetch(glbUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch GLB: ${response.statusText}`);
            }
            
            const glbArrayBuffer = await response.arrayBuffer();
            
            // Create a new scene for the conversion
            const scene = new THREE.Scene();
            
            // Load the GLB file
            const gltf = await new Promise((resolve, reject) => {
                this.gltfLoader.parse(glbArrayBuffer, '', resolve, reject);
            });
            
            console.log('✅ GLB loaded successfully');
            
            // Apply scaling if dimensions are provided
            if (dimensions && (dimensions.width_meters || dimensions.height_meters || dimensions.depth_meters)) {
                this.applyDimensionScaling(gltf.scene, dimensions);
            }
            
            // Add the model to the scene
            scene.add(gltf.scene);
            
            // Export to USDZ with optimized settings for iOS
            const usdzOptions = {
                maxTextureSize: 2048,
                includeAnchoringProperties: true,
                onlyVisible: true,
                quickLookCompatible: true // This should help with iOS compatibility
            };
            
            console.log('🔄 Exporting to USDZ...');
            const usdzArrayBuffer = await this.usdzExporter.parseAsync(scene, usdzOptions);
            
            console.log('✅ USDZ conversion completed successfully');
            return usdzArrayBuffer;
            
        } catch (error) {
            console.error('❌ USDZ conversion failed:', error);
            throw error;
        }
    }
    
    /**
     * Apply dimension-based scaling to the model
     * @param {THREE.Object3D} model - The loaded 3D model
     * @param {Object} dimensions - Target dimensions in meters
     */
    applyDimensionScaling(model, dimensions) {
        console.log('📏 Applying dimension scaling to model');
        
        // Calculate the bounding box of the model
        const boundingBox = new THREE.Box3().setFromObject(model);
        const currentSize = boundingBox.getSize(new THREE.Vector3());
        
        console.log('📐 Current model size:', {
            width: currentSize.x,
            height: currentSize.y,
            depth: currentSize.z
        });
        
        // Calculate scale factors
        let scaleX = 1, scaleY = 1, scaleZ = 1;
        
        if (dimensions.width_meters && currentSize.x > 0) {
            scaleX = dimensions.width_meters / currentSize.x;
        }
        if (dimensions.height_meters && currentSize.y > 0) {
            scaleY = dimensions.height_meters / currentSize.y;
        }
        if (dimensions.depth_meters && currentSize.z > 0) {
            scaleZ = dimensions.depth_meters / currentSize.z;
        }
        
        // Use uniform scaling (average of provided scales) for better proportions
        const scales = [];
        if (dimensions.width_meters) scales.push(scaleX);
        if (dimensions.height_meters) scales.push(scaleY);
        if (dimensions.depth_meters) scales.push(scaleZ);
        
        const uniformScale = scales.length > 0 ? scales.reduce((a, b) => a + b, 0) / scales.length : 1;
        
        console.log('🎯 Applying uniform scale factor:', uniformScale);
        console.log('📏 Target dimensions:', dimensions);
        
        // Apply the scaling to the model
        model.scale.set(uniformScale, uniformScale, uniformScale);
        
        console.log('✅ Dimension scaling applied');
    }
}

/**
 * Convenience function to convert GLB to USDZ
 * @param {string} glbUrl - URL to the GLB file
 * @param {Object} dimensions - Target dimensions in meters (optional)
 * @returns {Promise<ArrayBuffer>} - USDZ file as ArrayBuffer
 */
export async function convertGLBToUSDZ(glbUrl, dimensions = null) {
    const converter = new USDZConverter();
    return await converter.convertGLBToUSDZ(glbUrl, dimensions);
}