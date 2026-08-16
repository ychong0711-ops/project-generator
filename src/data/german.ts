/* ============================================================
 *  독일어 기술 어휘 — 자동차 임베디드 면접·정착 필수 단어
 * ============================================================ */

export interface GermanTerm {
  id: string;
  article: string;  // der / die / das
  term: string;
  meaning: string;
  cat: string;
}

export const GERMAN_TERMS: GermanTerm[] = [
  { id: 'g01', article: 'das', term: 'Steuergerät', meaning: 'ECU (전자제어장치)', cat: '전장' },
  { id: 'g02', article: 'das', term: 'Bordnetz', meaning: '차량 전기 시스템', cat: '전장' },
  { id: 'g03', article: 'der', term: 'Kabelbaum', meaning: '와이어링 하네스', cat: '전장' },
  { id: 'g04', article: 'die', term: 'Sicherung', meaning: '퓨즈', cat: '전장' },
  { id: 'g05', article: 'die', term: 'Spannung', meaning: '전압', cat: '전기' },
  { id: 'g06', article: 'der', term: 'Strom', meaning: '전류', cat: '전기' },
  { id: 'g07', article: 'der', term: 'Widerstand', meaning: '저항', cat: '전기' },
  { id: 'g08', article: 'die', term: 'Leistungselektronik', meaning: '전력전자', cat: '전기' },
  { id: 'g09', article: 'der', term: 'Wechselrichter', meaning: '인버터', cat: '전기' },
  { id: 'g10', article: 'die', term: 'Batterie', meaning: '배터리', cat: '전기' },
  { id: 'g11', article: 'das', term: 'Ladegerät', meaning: '충전기', cat: '전기' },
  { id: 'g12', article: 'das', term: 'Drehmoment', meaning: '토크', cat: '구동계' },
  { id: 'g13', article: 'der', term: 'Antriebsstrang', meaning: '구동계(드라이브트레인)', cat: '구동계' },
  { id: 'g14', article: 'der', term: 'Antrieb', meaning: '구동 / 추진', cat: '구동계' },
  { id: 'g15', article: 'das', term: 'Getriebe', meaning: '변속기', cat: '구동계' },
  { id: 'g16', article: 'die', term: 'Lenkung', meaning: '조향 장치', cat: '구동계' },
  { id: 'g17', article: 'die', term: 'Bremsanlage', meaning: '제동 장치', cat: '구동계' },
  { id: 'g18', article: 'die', term: 'Sensorik', meaning: '센서 시스템', cat: '측정' },
  { id: 'g19', article: 'die', term: 'Aktorik', meaning: '액추에이터 시스템', cat: '측정' },
  { id: 'g20', article: 'die', term: 'Messung', meaning: '측정', cat: '측정' },
  { id: 'g21', article: 'der', term: 'Prüfstand', meaning: '시험 벤치(테스트 리그)', cat: '측정' },
  { id: 'g22', article: 'die', term: 'Echtzeit', meaning: '실시간', cat: '소프트웨어' },
  { id: 'g23', article: 'der', term: 'Fehler', meaning: '오류 / 고장', cat: '소프트웨어' },
  { id: 'g24', article: 'der', term: 'Softwarestand', meaning: '소프트웨어 버전/상태', cat: '소프트웨어' },
  { id: 'g25', article: 'die', term: 'Anforderung', meaning: '요구사항', cat: '프로세스' },
  { id: 'g26', article: 'das', term: 'Lastenheft', meaning: '요구사항 명세서', cat: '프로세스' },
  { id: 'g27', article: 'das', term: 'Pflichtenheft', meaning: '설계 명세서', cat: '프로세스' },
  { id: 'g28', article: 'die', term: 'Absicherung', meaning: '검증 / 안전 보증', cat: '프로세스' },
  { id: 'g29', article: 'die', term: 'Inbetriebnahme', meaning: '시운전 / 가동 시작', cat: '프로세스' },
  { id: 'g30', article: 'die', term: 'Entwicklung', meaning: '개발', cat: '프로세스' },
];
