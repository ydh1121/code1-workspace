import {jsPDF} from 'jspdf';
let fontPromise;
async function font(){
  if(!fontPromise)fontPromise=fetch('/assets/RequestFont.ttf').then(r=>{if(!r.ok)throw Error('한글 글꼴을 불러오지 못했습니다.');return r.arrayBuffer();}).then(data=>{let result='';const a=new Uint8Array(data);for(let i=0;i<a.length;i+=8192)result+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(result);}).catch(e=>{fontPromise=null;throw e;});
  return fontPromise;
}
export async function requestDocument({name,items,due='',contact='',note=''},fontData){
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true});
  pdf.addFileToVFS('RequestFont.ttf',fontData||await font());pdf.addFont('RequestFont.ttf','CODE1Request','normal');pdf.setFont('CODE1Request');
  const left=20,width=170,bottom=274;let y=23,page=1;
  pdf.setProperties({title:`${name} 자료 요청서`,author:'CODE1',subject:'추가로 필요한 농가 자료'});
  function text(value,size=16,color='#223342'){pdf.setFontSize(size);pdf.setTextColor(color);return pdf.splitTextToSize(String(value),width);}
  function header(){y=30;}
  function next(){pdf.addPage();page++;header();}
  function line(value,size=16,gap=3){const lines=text(value,size);const step=size*.3528*1.6;for(const l of lines){if(y+step>bottom)next();pdf.setFontSize(size);pdf.setTextColor('#223342');pdf.text(l,left,y);y+=step;}y+=gap;}
  header();line(`${name}에 부탁드려요`,25,4);line(`추가로 필요한 자료 ${items.length}가지`,17,4);
  line('알고 계신 내용과 가지고 계신 자료부터 보내주세요.',16,1);
  line('사진은 휴대폰으로 찍어 보내주셔도 됩니다.',16,5);
  if(due)line(`보내주실 날짜: ${due}`,16,2);
  if(contact)line(`보내실 곳: ${contact}`,16,2);
  if(note)line(note,16,4);
  let group='';
  for(let i=0;i<items.length;i++){
    const q=items[i],label=q.item_label||q.plain_question;
    const lines=text(label,18);const needed=lines.length*10.2+13+(group!==q.section_name?17:0);
    if(y+Math.min(needed,70)>bottom)next();
    if(group!==q.section_name){group=q.section_name;pdf.setFillColor('#edf3fa');pdf.rect(left,y-5,width,12,'F');pdf.setFontSize(15);pdf.setTextColor('#175fa3');pdf.text(group,left+3,y+3);y+=18;}
    pdf.setDrawColor('#6c7e8f');pdf.rect(left,y-4,4,4);pdf.setFontSize(18);pdf.setTextColor('#223342');
    const available=width-10,wrapped=pdf.splitTextToSize(`${i+1}. ${label}`,available);
    for(const chunk of wrapped){if(y+10.2>bottom)next();pdf.setFontSize(18);pdf.setTextColor('#223342');pdf.text(chunk,left+10,y);y+=10.2;}
    const type=q.input_type==='SHOT'?'사진·영상으로 보내주세요.':q.input_type==='file'?'서류 사진이나 파일로 보내주세요.':'답변: __________________________________';
    if(y+9>bottom)next();pdf.setFontSize(14);pdf.setTextColor('#526477');pdf.text(type,left+10,y);y+=15;
  }
  const total=pdf.getNumberOfPages();for(let n=1;n<=total;n++){pdf.setPage(n);pdf.setFont('CODE1Request');pdf.setFontSize(12);pdf.setTextColor('#175fa3');pdf.text('CODE1  /  농가 자료 요청서',left,16);pdf.setFontSize(11);pdf.setTextColor('#64748b');pdf.text(`${name} · 자료 요청서`,left,288);pdf.text(`${n} / ${total}`,190,288,{align:'right'});}
  return pdf;
}
export async function downloadRequest(options){const pdf=await requestDocument(options);const safe=options.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,70);pdf.save(`${safe}_추가자료요청서.pdf`);}
if(typeof window!=='undefined')window.Code1Pdf={downloadRequest,requestDocument};
