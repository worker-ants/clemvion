### 발견사항

---

**[INFO]** `security/review.md` — `date.ts` 참조가 리뷰 대상 외 파일을 다룸
- 위치: `security/review.md` — `[WARNING]` 항목 "date.ts의 `use client` 경계 부재"
- 상세: `date.ts`는 `meta.json`의 리뷰 대상 9개 파일에 포함되지 않으며, "file not shown but referenced throughout"으로 명시됨. 리뷰 범위 외 파일에 대한 WARNING 등급 발견사항을 현재 리뷰 결과에 포함하는 것은 범위 이탈에 해당함. 다른 리뷰 세션이나 별도 항목으로 다루는 것이 적절.

---

**[INFO]** `security/review.md` — 서버 오류 메시지 노출 관련 "다수 파일" 참조
- 위치: `security/review.md` — `[INFO]` 항목 "서버 오류 메시지가 사용자에게 직접 노출됨"
- 상세: `error.response?.data?.message`를 참조하는 "다수 파일"은 i18n 구현 파일들과 무관한 기존 코드를 지칭함. 이번 변경에서 도입된 문제가 아님을 리뷰 본문에서도 인정하고 있어 현재 세션의 scope 내 발견사항으로 분류하기 어려움.

---

### 요약

리뷰 문서들은 전반적으로 i18n 인프라(`core.ts`, `locale-store.ts`, `locale-sync.tsx` 및 관련 테스트) 구현 범위 내에 집중되어 있으며 범위 이탈이 거의 없다. 다만 `security/review.md`에서 리뷰 대상 파일 목록에 포함되지 않은 `date.ts`를 WARNING 수준으로 다루고, 기존 코드베이스 전반의 오류 메시지 패턴을 현재 세션 발견사항으로 포함한 두 건이 경미한 범위 초과에 해당한다. 나머지 `performance`, `requirement`, `scope`, `side_effect`, `testing` 리뷰는 모두 지정된 파일 범위 내에서 적절히 작성되었다.

### 위험도

**NONE**