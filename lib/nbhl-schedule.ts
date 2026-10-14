type Division = { Id:number; Name?:string; ParentId?:number|null };
export type RawScheduleGame = { Id:number; Date?:string; StartTime?:string; LocalTeamId?:number; LocalTeamName?:string; VisitorTeamId?:number; VisitorTeamName?:string; LocalDivisionId?:number; LocalDivision?:string; VisitorDivisionId?:number; VisitorDivision?:string; DivisionList?:Division[]; SportCenterId?:number; SportCenterName?:string; Final?:boolean; StatusId?:number };
export type ScheduleGame = { id:string; date:string; time:string; homeId:string; home:string; visitorId:string; visitor:string; rinkId:string; rink:string; divisions:{id:string;name:string;parentId?:string}[]; status:string };
export function normalizeSchedule(games:RawScheduleGame[]):ScheduleGame[] {
  const seen=new Set<string>();
  return games.filter(game=>{const id=String(game.Id);if(!/^\d{1,10}$/.test(id)||seen.has(id))return false;seen.add(id);return true;}).map(game=>{
    const divisions=new Map<string,{id:string;name:string;parentId?:string}>();
    for(const division of game.DivisionList||[])divisions.set(String(division.Id),{id:String(division.Id),name:division.Name||`Division ${division.Id}`,parentId:division.ParentId?String(division.ParentId):undefined});
    for(const [id,name] of [[game.LocalDivisionId,game.LocalDivision],[game.VisitorDivisionId,game.VisitorDivision]] as const)if(id&&!divisions.has(String(id)))divisions.set(String(id),{id:String(id),name:name||`Division ${id}`});
    return {id:String(game.Id),date:(game.Date||"").slice(0,10),time:game.StartTime||"",homeId:String(game.LocalTeamId||""),home:game.LocalTeamName||"Home",visitorId:String(game.VisitorTeamId||""),visitor:game.VisitorTeamName||"Visitor",rinkId:String(game.SportCenterId||""),rink:game.SportCenterName||"Rink unavailable",divisions:[...divisions.values()],status:game.Final||game.StatusId===3?"Final":game.StatusId===2?"Live":"Scheduled"};
  }).sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)||a.id.localeCompare(b.id));
}
export function filterSchedule(games:ScheduleGame[],filters:{from:string;to:string;division:string;rink:string;team:string}) {
  return games.filter(game=>(!filters.from||game.date>=filters.from)&&(!filters.to||game.date<=filters.to)&&(!filters.division||game.divisions.some(division=>division.id===filters.division||division.parentId===filters.division))&&(!filters.rink||game.rinkId===filters.rink)&&(!filters.team||game.homeId===filters.team||game.visitorId===filters.team));
}
