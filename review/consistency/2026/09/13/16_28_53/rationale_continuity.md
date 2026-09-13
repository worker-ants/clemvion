# Rationale 연속성 검토 — `spec/conventions/` (impl-done, 라운드 6)

## 스코프 판단 (실측)

`spec/conventions/**` 델타: **0개 파일** (프롬프트 예산 절단 전 `git diff origin/main --stat -- spec/conventions/`, HEAD 워킹트리에서 직접 재실측 — `1984d72d3` 기준으로도 동일). 프롬프트 번들 본문은 대부분 "컨텍스트 예산 초과" 로 절단돼 있어(§46 이후 다수), 이번 판정은 프롬프트가 아니라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)를 절대경로로 직접 열어 수행했다.

이번 라운드까지 `codebase/**` 델타는 `origin/main` 대비 5개 파일(613+/375-, `guide-error-code-*` → `guide-identifier-*` 리네임 포함)이며, 직전 라운드(`16_04_45`, 라운드 5) 이후 신규 커밋은 `1984d72d3`("라운드 5 — 정규식 5개 전수 감사") 하나뿐이다. `git diff 6b4c03af6 1984d72d3` 로 그 델타만 분리해 확인했다:

- `guide-identifier-scan.ts`: `CODE_FIELD` 좌경계를 `(?<![A-Za-z])` → `(?<!\w)` 로 재수정(스네이크케이스 `error_code`/`http_code` 누락 버그 수정) + 정규식 5개 전수 감사 표를 파일 상단에 신설
- `guide-identifier-existence.test.ts`: `collectSourceTokens` 경계 대조군 5건 + `CODE_FIELD` 신판 경계를 겨냥한 음성 fixture 2건(`error_code`/`http_code`) 추가
- `plan/in-progress/spec-draft-nullable-notation-followups.md`: 무관한 신규 항목 1건(`lastIndex` 리셋 보일러플레이트 중복, maintainability) 등재 — 아래 WARNING 대상 항목은 **미변경**
- `spec/**` 은 이번 델타에 없음

즉 이번 라운드의 신규 표면은 순수 정규식 경계 버그 수정(스코프를 좁히는 방향이 아니라 **좁혔던 것을 원상 확장**하는 방향)이며, "허용목록 없음"·"백틱 전수 문맥 무관" 등 이 PR 이 이미 세운 설계 원칙과 무관하다.

## 발견사항

- **[WARNING]** `#1330` 이 세운 "허용목록 없음" 설계 원칙의 번복이 spec `## Rationale` 밖에 계속 머문다 (6라운드 연속 동일 — `14_41_43`→`15_03_36`→`15_23_53`→`15_43_24`→`16_04_45`→본 라운드)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:44-51`("허용목록을 둔다 — 그리고 그 결정의 대가를 적는다" 절, `GUIDE_EXTERNAL_VOCABULARY` 정의) · `plan/in-progress/guide-identifier-existence.md §C`("`#1330` 의 '허용목록 없음' 은 이번 축에서 유지할 수 없다") · `plan/in-progress/spec-draft-nullable-notation-followups.md:3255-3262` 부근의 planner 등재 draft
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` — "전수 열거(82종) + 허용목록도 검토했고 기각했다 … 허용목록을 미리 파 두면 '…Planned 니까…' 로 오늘의 결함이 다시 들어온다." `spec/conventions/user-guide-evidence.md §2`("Build-time 가드 (3건)" 표, 재확인 결과 여전히 `impl-anchor-existence`·`integrations-coverage`·`triggers-coverage` 3건뿐, frontmatter `code:` 목록에도 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`/`guide-sanitized-message-parity.test.ts` 3파일 부재) 및 `spec/conventions/error-codes.md §Rationale`(둘 다 이 가드 계열에 대한 언급 0건, 이번 라운드에도 재확인)
  - 상세: 이번 PR 은 "허용목록 없음" 원칙을 실측 근거(문맥 게이팅으로는 이 가드를 만들게 한 과거 결함 `MCP_INSECURE_URL_ALLOWED` 자체를 못 잡는다는 재현 테스트)로 명시적으로 뒤집는다. 번복 자체는 무근거가 아니다 — 코드 JSDoc·plan §A/B/C 양쪽에 실측 표와 함께 상세히 남아 있고, `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템 이름 의무·상한·여전히 인용될 것·기준집합 부재 단언)로 은폐 위험도 낮췄다. 문제는 이 근거가 `CLAUDE.md` 가 정한 자리(해당 spec 문서 끝 `## Rationale`)로 아직 승격되지 않았다는 것뿐이다. developer 는 이를 스스로 인지해 plan frontmatter 주석에 "`user-guide-evidence.md §2` 등재는 필요하고 **developer 권한 밖**" 이라 명시했고, planner 가 그대로 옮겨 쓸 수 있는 2문단 Rationale 초안(① 왜 '허용목록 없음' 을 못 지켰는가, ② 왜 이번 허용목록은 `guide-error-code-truth.md §D` 가 기각한 것과 다른가)을 `spec-draft-nullable-notation-followups.md` 에 이미 남겨 두었다. 이번 라운드의 신규 변경(`CODE_FIELD` 좌경계 재수정 + 대조군 보강)은 이 원칙과 무관한 순수 버그 수정이며, 새 Rationale 번복도 새 invariant 우회도 만들지 않는다 — 즉 이 WARNING 의 **내용은 라운드 5 대비 변화가 없다.**
  - 왜 CRITICAL 이 아니라 WARNING 인가: (1) 뒤집힌 원칙이 애초에 spec `## Rationale` 에 있던 적이 없다 — "spec 이 명시적으로 기각한 대안의 재도입" 요건을 문자 그대로 충족하지 않는다(완료된 plan 문서·코드 주석 수준의 결정이지 spec 수준이 아니다). (2) 번복에 측정 근거가 딸려 있고 은폐 방지 강제가 코드·뮤테이션으로 검증됐다. (3) developer 가 권한 경계를 지키며 완결된 형태의 백로그 항목(승격용 Rationale 초안 포함)을 이미 등재했다 — spec 을 직접 고치는 월권을 하지 않았다.
  - 제안: planner 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신 — (1) §2 표에 `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`) 및 `guide-sanitized-message-parity.test.ts` 행 추가(3건→5건), (2) frontmatter `code:` 목록에 세 파일 추가, (3) 신규 `## Rationale` 항목 — draft 는 `spec-draft-nullable-notation-followups.md` 해당 위치에 이미 있으므로 복붙 수준. **6라운드 연속 developer 쪽 조치는 완료 상태**이고 남은 유일한 조치는 planner 턴이다 — 이 리뷰가 developer 작업을 추가로 막을 근거는 없다.

- **[INFO]** 부분 재도입은 `#1330`("frontend 자기증명 오염" 기각 사유) 을 여전히 보존한다 (라운드 5 대비 미변경)
  - target 위치: `guide-identifier-existence.test.ts`("frontend 소스는 **넣지 않는다**" 주석) · `guide-identifier-scan.ts` (`collectSourceTokens`/`collectEnvDeclarations` 가 backend·packages·env 선언처만 대상)
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` — "frontend 소스를 기준집합에 넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로 자기를 증명한다."
  - 상세: `#1330` 이 기각한 대안은 (a) 전수 열거(백틱 무조건) + (b) 그로 인해 필요해지는 기준집합 확장(frontend 포함, 자기증명 오염)의 결합이었다. 이번 PR 은 (a)만 채택하고 (b)는 계속 거부한다(기준집합 = backend·packages ∪ env 선언처, frontend 미포함). 기각 사유 중 분리 가능한 절반만 선택적으로 뒤집은 것이며 통째 재도입이 아니다.
  - 제안: 없음 — 위 WARNING 의 Rationale 신설 시 "무엇을 뒤집고 무엇을 보존했는가" 를 한 문장으로 포함할 것(기존 초안에 이미 반영돼 있음, 재확인만).

## 요약

이번 라운드의 `spec/conventions/**` 델타는 여전히 0이며, 라운드 5(`16_04_45`) 이후 신규 코드 변경은 `CODE_FIELD` 정규식 좌경계를 `(?<![A-Za-z])` 에서 `(?<!\w)` 로 재수정하고 대조군을 보강한 순수 버그 수정 하나뿐으로, 기존 spec `## Rationale` 어느 항목과도 충돌하지 않는다. 지속적으로 열려 있는 유일한 항목은 developer 가 실측 근거를 갖춰 명시적으로 뒤집은 `#1330` 의 "허용목록 없음" 원칙인데, 그 번복 자체는 절차(권한 경계 준수·뮤테이션 검증·planner 백로그에 승격용 Rationale 초안까지 완비해 위임)와 근거 모두 갖춰져 있고, 유일하게 남은 결손은 그 근거를 spec `## Rationale` 로 아직 승격하지 않았다는 점뿐이다. 이 WARNING 은 6라운드 연속(14:41→15:03→15:23→15:43→16:04→16:28) 동일하게 열려 있고 developer 쪽 조치는 이미 완료된 상태라, 이후 조치는 순수히 planner 턴의 몫이다. Rationale 연속성 관점에서 이 PR 을 codebase 쪽에서 더 막을 이유는 없다.

## 위험도

MEDIUM
