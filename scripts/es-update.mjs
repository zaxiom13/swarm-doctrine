// Antithetic ES: paired rollouts share maps; reward differences weight noise.
export function averagedDirection(pairs, sigma) {
    if(!pairs.length||!(sigma>0))throw new Error('ES needs pairs and positive sigma');
    const scores=pairs.flatMap(p=>[p.plus,p.minus]);
    const mean=scores.reduce((a,b)=>a+b,0)/scores.length;
    const std=Math.sqrt(scores.reduce((a,b)=>a+(b-mean)**2,0)/scores.length);
    const direction=new Float64Array(pairs[0].noise.length);
    if(std<1e-9)return direction;
    for(const pair of pairs)for(let j=0;j<direction.length;j++)direction[j]+=(pair.plus-pair.minus)*pair.noise[j]/(2*pairs.length*sigma*std);
    return direction;
}
export function perturb(model,noise,scale){return {...model,weights:model.weights.map((w,j)=>w+scale*noise[j])};}
