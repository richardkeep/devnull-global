import React, {useMemo} from 'https://esm.sh/react@18.3.1';
const positions = [[7,74,33],[16,88,42],[35,93,30],[60,84,38],[83,89,33],[93,67,44],[87,22,31],[65,7,30],[38,9,35],[8,43,32]];
export function PastrySprinkles(){
  const pastries = useMemo(()=>positions.map(([x,y,size],i)=>React.createElement('img',{
    key:i,className:'pastry',src:'https://dev-null.sh/pastel-de-nata.svg',
    alt:'',loading:'lazy',style:{left:x+'%',top:y+'%','--size':size+'px',
      '--duration':(5+i%4)+'s','--delay':(-i*0.7)+'s'}
  })),[]);
  return React.createElement('div',{id:'pastry-sprinkles','aria-hidden':'true'},...pastries);
}
