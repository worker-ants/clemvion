# 요구사항(Requirement) 리뷰 — CHANGELOG 미동반 PR 12건 백필 (`33299dff8`)

## 검토 대상과 방법

리뷰 대상 커밋(`33299dff8`, `docs(changelog): 미동반 PR 12건 재판정 — 10건을 주제별 6항목으로 백필`)은
`codebase/**` 를 건드리지 않는 순수 문서 변경이다 — `CHANGELOG.md` 6항목 신설(+2줄 기준 보강),
신규 plan `plan/in-progress/changelog-backfill-12.md`, 트래커 체크박스 정정,
그리고 사전 `--plan` consistency-check 산출물(5개 checker + SUMMARY) 커밋이다.

일반적인 "요구사항 충족" 관점(엣지 케이스·에러 시나리오·반환값·데이터 유효성)은 코드가 아니라
**과거 사실에 대한 서술의 정확성**으로 치환된다. 이 문서가 본질적으로 하는 일은 "이 PR 이 CHANGELOG
항목을 낼 자격이 있는가" 를 성문 기준(`#1397`)에 따라 판정하고, 그 판정 근거(수치·파일명·코드 동작)가
실제 커밋과 spec 본문에 부합하는지가 유일한 실질적 결함 표면이다. 그래서 판정표(§A)가 인용하는
핵심 기술적 주장 다수를 `git log -1 --format=%B <sha>` 와 실제 소스로 직접 대조했다.

## 발견사항

- **[INFO]** 체크리스트 두 항목(`/ai-review`, `plan/complete/` 이동)이 미완 상태
  - 위치: `plan/in-progress/changelog-backfill-12.md` §C (게이트 숫자 62, 64 — "`- [ ] /ai-review`" · "`- [ ] plan 을 `plan/complete/` 로 이동`")
  - 상세: 이 리뷰 자체가 그 미완 항목("`/ai-review`")을 채우는 절차이므로 결함이 아니라 정상적인 진행
    상태다. 리뷰 통과 후 plan 이동이 남는다.
  - 제안: 리뷰 반영 후 plan 을 `plan/complete/` 로 이동하고 체크박스를 갱신할 것(정보 목적, 조치 불요).

- **[INFO]** 사전 `--plan` consistency-check WARNING 2건은 이미 같은 커밋 안에서 해소됨(확인 기록)
  - 위치: `plan/in-progress/changelog-backfill-12.md` §A 판정표 `#1238` 행("~~spec 0~~ — `--plan` W1: …"),
    `#1270` 행("**캐비엇**(`--plan` W2): 그레이스풀 드레인 중엔 …") — 게이트 숫자 34, 25
  - 상세: `review/consistency/2026/09/25/13_31_14/cross_spec.md` 의 WARNING(`#1238` "spec 0" 근거가
    `spec/5-system/6-websocket-protocol.md:1298-1302` 의 실제 Rationale 서술과 어긋남)과
    `plan_coherence.md` 의 WARNING(`#1270` 판정이 원 plan `ws-token-expired-socket-lifetime-impl.md` 의
    미해결 캐비엇과 단절)을 직접 `Read`/`grep` 으로 재확인했다. 두 spec/plan 문서 모두 지적된 그대로였고,
    판정표의 최종 커밋 텍스트에는 두 정정이 **이미 반영되어 있다**(정정 전 상태가 아니라 정정 후 상태가
    커밋됨). 잔여 WARNING 없음.
  - 제안: 없음(확인 완료).

## 사실관계 교차 검증 결과 (요구사항 9: spec/이력 fidelity)

`CHANGELOG.md` 는 `spec/` 산하 문서가 아니라 저장소 운영 문서이고, 그 판정 기준("무엇이 항목을
만드는가")도 `spec/conventions/` 가 아니라 `CHANGELOG.md` 자체 상단에 있다(§B `plan/complete/changelog-criteria.md`
의 명시적 결정 — planner 재량, 결함 아님). 따라서 이 항목의 "spec 본문 일치" 는 판정표가 인용하는
**실제 커밋 동작**과 **관련 spec Rationale** 양쪽에 대한 사실 정확성으로 치환해 검증했다. 아래는 직접
`git show <sha>`/`git log -1 --format=%B <sha>`/`grep` 으로 재현·대조한 항목이다 — 전부 CHANGELOG 서술과 **일치**했다.

| PR | 검증한 주장 | 결과 |
|---|---|---|
| `#1206` (`e5ba923ca`) | "축약형 `type: Object` 는 `type: object` 로 해석되지만 `additionalProperties` 가 붙지 않는다" | 커밋 본문의 `createDocument` 산출 비교표와 글자 그대로 일치 |
| `#1326` (`9762fe53f`) | "`rotate-bot-token` 이 404 · 래핑된 200 DTO(`ChatChannelRotateBotTokenDto`)를 광고, 종전 데코레이터 전무" | 커밋 본문 "`@ApiNotFoundResponse` + `@ApiOkWrappedResponse` + 신규 `ChatChannelRotateBotTokenDto`" 와 일치 |
| `#1270` (`6501c19bc`) | ".unref() 도입, 최대 900초 셧다운 지연, 그레이스풀 드레인 중 사전 통지 누락 캐비엇" | 커밋 본문·후속 서브사이클 커밋(2R W1 "런북에 없었다")과 일치 |
| `#1364` (`046ec5ba3`) | "`046ec5ba3^` 에서도 가드가 `AbortSignal.timeout` 보다 먼저 돈다 — main 대비 순 변화 없음" | `git show 046ec5ba3^:codebase/backend/src/modules/integrations/http-connection-tester.ts` 로 직접 확인 — 개정 전에도 `outboundBlockReason` → `AbortSignal.timeout` 순서. 현재 `main` 도 같은 순서(가드 먼저) |
| `#1354` (`4157bc557`) | "선언 104개, DB 대조로 여덟 곳 정정" | 커밋 본문 "선언 104개... 대조했고... 여덟 곳" 일치 |
| `#1358` (`6f9c0f1c1`) | "아홉 곳(uuid 누락 5·enum 이름 2·기본값 2), `default` 선언 컬럼은 insert 뒤 엔티티에 채워짐" | 커밋 본문과 정확히 일치(수치·인과 서술 모두) |
| `#1261` (`41fa80dc2`) | "패키지 6/8 이 무따옴표 글롭으로 최상위 18개 스킵, `parser.ts:317` case 스코프 에러" | 커밋 본문과 일치 |
| `#1262` (`a36395f5c`) | "도구 태그 잔재 가드 신설·체크박스 정규식이 인용문 안 `[ ]` 를 보게(판정 뒤집히는 문서 0건)" | 커밋 본문과 일치 (문구까지 동일) |
| `#1263` (`7b2604eb5`) | "baseline 51건/14파일, `jest-axe.d.ts` `declare module \"vitest\"` 가 shadowing" | 커밋 본문과 일치 |
| `#1275` (`b79dafdf9`) | "`\| null` 필드 135개 전수, 잔존 0, walker 5개 통합" | 커밋 본문과 일치 |
| `#1245` (`0f0d5dde9`) | "1행이 `STATUS=` 인 파일 536개, 기존분은 이력 변조라 미수정" | 커밋 본문과 정확히 일치(824 vs 536 구분까지) |
| `#1238` "spec 0" → 정정 | `spec/5-system/6-websocket-protocol.md:1298-1302` 가 `#1238` 을 실제로 인용 | `grep` 으로 확인 — 정정 문구가 커밋에 이미 반영됨 |

12건 판정(10 항목 · 2 비항목) 목록은 `plan/complete/changelog-criteria.md` §B 가 위임한 12건 후보 명단과
정확히 1:1 대응하고 누락·추가가 없다. CHANGELOG.md 상단 기준 ①에 "OpenAPI 로 광고하는 계약" · "판정은
main 대비" 두 구절을 보탠 것은 `#1206`/`#1326`(런타임 불변·OpenAPI 계약 변화)과 `#1364`(PR 내부 회귀·복구)
사례에서 실제로 드러난 기준의 빈칸을 메우는 것으로, 기존 기준을 좁히는 제한 조항이 없었다는 점에서
무근거 번복이 아니라 명시적 보강이다(rationale_continuity checker 도 같은 결론).

## 요약

본 PR 은 코드 동작을 바꾸지 않는 CHANGELOG 백필 문서 작업으로, 통상적인 기능 완전성·엣지 케이스·에러
시나리오·반환값 관점은 대부분 적용 대상이 아니다. 핵심 리스크는 "판정표에 실리는 사실관계가 정확한가"
였고, 12건 중 판정 근거로 인용된 핵심 수치·코드 동작·spec 서술을 실제 커밋(`git show`)과 spec 본문으로
직접 재현·대조한 결과 전부 일치했다(#1206·#1326·#1270·#1364·#1354·#1358·#1261·#1262·#1263·#1275·#1245·#1238).
특히 `#1364` "비항목" 판정의 근거인 "PR 내부에서 생겼다 사라진 회귀"라는 주장은 `046ec5ba3^`(PR 이전)
소스를 직접 열어 재현했고 정확했다. 사전 `--plan` consistency-check 가 낸 WARNING 2건(`#1238` "spec 0"
근거 오류, `#1270` 원 plan 미해결 캐비엇과의 단절)은 리뷰 대상 커밋 안에 이미 정정 반영돼 있어 잔여
결함이 없다. CRITICAL·WARNING 급 발견사항 없음.

## 위험도

NONE
