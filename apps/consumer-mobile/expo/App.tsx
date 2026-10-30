import React, { useState } from "react";
import { SafeAreaView, View, Text, StyleSheet, StatusBar, Pressable, TextInput, ActivityIndicator, Linking, ScrollView } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Fingerprint, ScanLine, ShieldCheck, AlertTriangle, ArrowLeft, Info, Keyboard } from "lucide-react-native";

const API = process.env.EXPO_PUBLIC_PAN_API_URL || "http://10.0.2.2:4000/api";
type VerifyResult = { status:string; title:string; message:string; product?:{name:string;brand?:string|null;manufacturer:string;batchCode:string;category?:string|null;productionDate?:string|null;expiryDate?:string|null}; checkedAt?:string; scansRecorded?:number };

export default function App() {
  const [permission,requestPermission]=useCameraPermissions();
  const [scanning,setScanning]=useState(false);
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState<VerifyResult|null>(null);
  const [error,setError]=useState("");
  const [code,setCode]=useState("");
  const [showManual,setShowManual]=useState(false);
  const [lastScan,setLastScan]=useState("");
  async function verify(value:string) {
    setScanning(false);setLoading(true);setError("");setResult(null);setLastScan(value);
    try {
      const tokenMatch=value.match(/\/v\/([A-Za-z0-9_-]{30,60})/);
      const publicCode=value.match(/PAN-[A-Fa-f0-9]{20}/i)?.[0] || (value.startsWith("PAN-")?value:"");
      const url=tokenMatch?API+"/v1/verify/"+tokenMatch[1]:publicCode?API+"/v1/verify/code/"+encodeURIComponent(publicCode):"";
      if(!url) throw new Error("This QR code is not a recognised PAN product identity.");
      const response=await fetch(url);const data=await response.json();
      if(!response.ok) throw new Error(data.message||"We could not verify this identity.");
      setResult(data);
    } catch(e:any) { setError(e.message||"Verification is temporarily unavailable. Please try again."); }
    finally {setLoading(false);}
  }
  function onBarcodeScanned(event:{data:string}) { if(scanning){setScanning(false);void verify(event.data);} }
  async function openCamera(){setError("");setResult(null);if(!permission?.granted){const p=await requestPermission();if(!p.granted){setError("Camera permission is needed to scan product QR codes. You can still enter a product ID manually.");return;}}setScanning(true);}
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#f7f8f4"/><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={styles.brandMark}><Fingerprint color="#e4f1e9" size={21}/></View><View><Text style={styles.brand}>pan<Text style={{color:"#c69b5e"}}>.</Text></Text><Text style={styles.caption}>PRODUCT AUTHENTICATION</Text></View><View style={{flex:1}}/><ShieldCheck color="#78927e" size={19}/></View>
    {!result&&!error&&!scanning&&!loading&&<><View style={styles.hero}><Text style={styles.kicker}>PRODUCT VERIFICATION</Text><Text style={styles.title}>Know what{"\n"}you’re <Text style={styles.italic}>holding.</Text></Text><Text style={styles.subtitle}>Every product deserves an identity. Scan a PAN code to understand its verification record.</Text></View><View style={styles.scanCard}><View style={styles.scanIcon}><ScanLine color="#52785d" size={42}/></View><Text style={styles.scanTitle}>Ready to verify?</Text><Text style={styles.scanText}>Position the product’s QR code inside the scanner frame.</Text><Pressable style={styles.scanButton} onPress={openCamera}><Text style={styles.scanButtonText}>Open scanner</Text></Pressable><Pressable style={styles.manualLink} onPress={()=>setShowManual(!showManual)}><Keyboard color="#52785d" size={14}/><Text style={styles.manualLinkText}>Enter a product ID instead</Text></Pressable></View><View style={styles.note}><ShieldCheck color="#75947b" size={17}/><Text style={styles.noteText}>No account needed. Your location is never required to verify a product.</Text></View></>}
    {scanning&&<View style={styles.cameraCard}><View style={styles.cameraHeader}><Text style={styles.scanTitle}>Scan product QR code</Text><Pressable onPress={()=>setScanning(false)}><Text style={styles.cancel}>Cancel</Text></Pressable></View><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{barcodeTypes:["qr"]}} onBarcodeScanned={onBarcodeScanned}/><Text style={styles.scanText}>Hold steady. The code will be checked automatically.</Text></View>}
    {loading&&<View style={styles.stateCard}><ActivityIndicator color="#1d4b3d" size="large"/><Text style={styles.scanTitle}>Checking this identity…</Text><Text style={styles.scanText}>Connecting securely to the PAN network.</Text></View>}
    {showManual&&!scanning&&!loading&&!result&&<View style={styles.manualCard}><Text style={styles.scanTitle}>Enter product ID</Text><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="PAN-0123456789ABCDEF" style={styles.input}/><Pressable style={styles.scanButton} onPress={()=>void verify(code.trim().toUpperCase())}><Text style={styles.scanButtonText}>Verify product ID</Text></Pressable></View>}
    {error!==""&&<View style={styles.resultCard}><View style={styles.warningIcon}><AlertTriangle color="#a46b31" size={26}/></View><Text style={styles.resultTitle}>We couldn’t complete the check.</Text><Text style={styles.resultText}>{error}</Text><Text style={styles.resultHint}>A connection problem is not evidence that a product is counterfeit.</Text><Pressable style={styles.scanButton} onPress={()=>{setError("");setResult(null);setShowManual(false)}}><Text style={styles.scanButtonText}>Try again</Text></Pressable></View>}
    {result&&<View style={styles.resultCard}><View style={result.status==="VERIFIED"?styles.successIcon:styles.warningIcon}>{result.status==="VERIFIED"?<ShieldCheck color="#2f7651" size={28}/>:<AlertTriangle color="#a46b31" size={27}/>}</View><Text style={styles.kicker}>PAN NETWORK RESULT</Text><Text style={styles.resultTitle}>{result.title}</Text><Text style={styles.resultText}>{result.message}</Text>{result.product&&<View style={styles.productRecord}><Text style={styles.recordLabel}>PRODUCT RECORD</Text><Text style={styles.productName}>{result.product.name}</Text><View style={styles.recordRow}><Text style={styles.recordKey}>Manufacturer</Text><Text style={styles.recordValue}>{result.product.manufacturer}</Text></View><View style={styles.recordRow}><Text style={styles.recordKey}>Batch reference</Text><Text style={styles.recordValue}>{result.product.batchCode}</Text></View>{result.product.category&&<View style={styles.recordRow}><Text style={styles.recordKey}>Category</Text><Text style={styles.recordValue}>{result.product.category}</Text></View>}</View>}<View style={styles.note}><Info color="#75947b" size={16}/><Text style={styles.noteText}>PAN confirms an identity record, not the physical contents, quality or regulatory approval.</Text></View><Pressable style={styles.scanButton} onPress={()=>{setResult(null);setError("");setShowManual(false);setCode("")}}><Text style={styles.scanButtonText}>Verify another product</Text></Pressable></View>}
    <View style={styles.footer}><Text style={styles.footerText}>BUILT FOR TRUST. DESIGNED FOR EVERYONE.</Text></View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f7f8f4"},page:{flexGrow:1,paddingHorizontal:22,paddingTop:14,paddingBottom:18},
 header:{flexDirection:"row",alignItems:"center",gap:10},brandMark:{width:38,height:38,borderRadius:11,backgroundColor:"#173b32",alignItems:"center",justifyContent:"center"},brand:{fontSize:23,fontWeight:"800",letterSpacing:-1.5,color:"#173b32"},caption:{fontSize:7,letterSpacing:1,color:"#87948b",fontWeight:"700",marginTop:2},
 hero:{marginTop:58},kicker:{fontSize:9,fontWeight:"700",letterSpacing:1.5,color:"#819287"},title:{fontSize:45,fontWeight:"800",lineHeight:51,letterSpacing:-2.5,color:"#203a2e",marginTop:17},italic:{color:"#78977e"},subtitle:{fontSize:13,lineHeight:21,color:"#7d8b81",marginTop:13,maxWidth:330},
 scanCard:{marginTop:28,backgroundColor:"#fff",borderRadius:17,borderWidth:1,borderColor:"#e2e9df",padding:22,alignItems:"center"},scanIcon:{width:86,height:86,borderRadius:16,backgroundColor:"#eff4ed",alignItems:"center",justifyContent:"center",marginBottom:16},scanTitle:{fontSize:16,fontWeight:"700",color:"#31483a"},scanText:{fontSize:11,lineHeight:18,textAlign:"center",color:"#849087",marginTop:7,maxWidth:280},scanButton:{height:45,alignSelf:"stretch",borderRadius:9,backgroundColor:"#173b32",alignItems:"center",justifyContent:"center",marginTop:19},scanButtonText:{color:"#fff",fontSize:12,fontWeight:"700"},manualLink:{flexDirection:"row",alignItems:"center",gap:7,marginTop:16,padding:5},manualLinkText:{fontSize:11,color:"#52785d",fontWeight:"600"},
 note:{marginTop:20,flexDirection:"row",alignItems:"center",gap:10,padding:14,backgroundColor:"#eff3ec",borderRadius:10},noteText:{flex:1,fontSize:10,lineHeight:16,color:"#849287"},
 cameraCard:{marginTop:28,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#e2e9df",padding:14,overflow:"hidden"},cameraHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingBottom:12},camera:{height:390,borderRadius:12,overflow:"hidden"},cancel:{fontSize:12,color:"#a46b31",fontWeight:"700"},
 manualCard:{marginTop:20,backgroundColor:"#fff",padding:18,borderRadius:14,borderWidth:1,borderColor:"#e2e9df"},input:{height:46,borderWidth:1,borderColor:"#e2e9df",borderRadius:9,paddingHorizontal:12,marginTop:14,fontSize:12,color:"#203a2e"},
 stateCard:{marginTop:45,alignItems:"center",padding:35,backgroundColor:"#fff",borderRadius:16,gap:14},
 resultCard:{marginTop:28,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#e2e9df",padding:20},successIcon:{width:54,height:54,borderRadius:16,backgroundColor:"#e9f3eb",alignItems:"center",justifyContent:"center",marginBottom:18},warningIcon:{width:54,height:54,borderRadius:16,backgroundColor:"#fff2e6",alignItems:"center",justifyContent:"center",marginBottom:18},resultTitle:{fontSize:24,fontWeight:"800",lineHeight:30,letterSpacing:-.7,color:"#203a2e",marginTop:10},resultText:{fontSize:12,lineHeight:20,color:"#718078",marginTop:9},resultHint:{fontSize:10,lineHeight:16,color:"#9a7650",borderTopWidth:1,borderTopColor:"#edf0eb",paddingTop:12,marginTop:14},
 productRecord:{backgroundColor:"#f7f9f6",borderWidth:1,borderColor:"#e8eee8",borderRadius:12,padding:15,marginTop:18},recordLabel:{fontSize:9,letterSpacing:1,color:"#8a988f",fontWeight:"700"},productName:{fontSize:18,fontWeight:"700",color:"#173b32",marginVertical:11},recordRow:{flexDirection:"row",justifyContent:"space-between",gap:10,paddingVertical:7,borderTopWidth:1,borderTopColor:"#e9eee8"},recordKey:{fontSize:10,color:"#8b9990"},recordValue:{fontSize:10,color:"#30473b",fontWeight:"600",flexShrink:1,textAlign:"right"},
 footer:{marginTop:"auto",paddingVertical:26,alignItems:"center"},footerText:{fontSize:8,letterSpacing:1,color:"#a1aba3",fontWeight:"700"}
});
