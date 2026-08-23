# 변경 범위(Scope) Review

## 검토 방법

`git log`/`git show --stat`/`git show --name-status` 로 2개 커밋(a3c9b3578, c4356b367)의
diff 를 직접 재구성해 프롬프트에 실린 15개 파일 목록과 대조했다. 프롬프트에서 컨텍스트
예산으로 잘린 3개 파일(`interaction.service.spec.ts`, `interaction.service.ts` 나머지,
`spec-sync-external-interaction-api-gaps.md`, `spec/5-system/14-external-interaction-api.md`)은
diff 자체(추가분)는 온전히 실려 있어 판단에 지장이 없었다. `spec/5-system/14-external-interaction-api.md`
의 전체 diff 를 `git diff HEAD~2 HEAD --` 로 재확인해 프롬프트에 실린 R17 단락 교체가 전부이고
숨은 hunk 가 없음을 확인했다.

## 발견사항

(없음 — 아래 "요약" 참조)

## 조사했으나 위반 없음 확인 (positive findings)

- **커밋 2개 모두 diff 범위가 작업 의도와 정확히 일치**: `codebase/backend` 4개 소스 파일(구현
  2 + spec 2), `plan/in-progress` 2개(신규 트래커 + 상위 트래커 갱신), `review/consistency/**`
  8개(구현 착수 전 `--impl-prep` 산출물), `spec/5-system/14-external-interaction-api.md` 1개.
  설정 파일·무관한 모듈·포맷터 drive-by 변경 없음.
- **import 변경이 정확히 신규 사용에 대응**: `interaction.service.ts` 는 `allowlistNodeOutputKeys`
  1개만 추가 import 하며 실제로 `stripAndRedact(...)` 결과를 감싸는 데 쓴다(사용 안 하는 import
  없음). `strip-external-only-fields.ts` 의 `NodeHandlerOutput` type import 도
  `PublicHandlerOutputKey` 파생에 실사용.
- **주석 변경은 전부 신규 코드 설명**: `interaction.service.ts:388-391`(unified diff 게이트
  기준) 새 주석은 바로 아래 추가된 `allowlistNodeOutputKeys` 호출을 설명하며, 기존 주석
  (`385-387`)은 원문 그대로 보존됐다. `strip-external-only-fields.ts` 의 대형 JSDoc 블록도
  신규 export(`NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys`) 전용이고 기존
  `EXTERNAL_STRIPPED_FIELDS` JSDoc 은 무변경.
- **컴파일타임 결속(`PublicHandlerOutputKey`/`assertAllowlistCoversHandlerContract`)은
  over-engineering 이 아니라 계획된 설계**: `plan/in-progress/nodeoutput-allowlist.md` 의
  "## 설계 — 타입 계약에서 파생한다" 절이 착수 시점부터 이 방식을 명시했고, `--impl-prep`
  단계에서 "발명하지 않고 파생" 이라는 JSDoc 과장 표현(INFO 2)을 지적받자 그 주장을 실제로
  참으로 만들기 위해 도입된 것으로 plan 에 근거가 남아 있다. 범위는 8줄 내외로 최소.
- **컨설턴시 체크가 제안한 무관 수정(§5.3→§5.6 cross-reference 오타, `spec/5-system/…` §3.5
  `EIA-NF-05`)은 실제로 손대지 않았다** — "발견된 김에" 권고였음에도 diff 에 포함되지 않아
  scope 규율이 지켜졌다(`git diff HEAD~2 HEAD -- spec/…` 에서 `EIA-NF-05`/`§5.3`/`§5.6` 매치 0건).
- **신규 트래커 항목(SSE/fanout 잔여) 등재는 기능 구현이 아니라 후속 항목 기록**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 추가된 불릿은 `toFanoutEnvelope` 코드를 건드리지
  않고 "왜 지금 안 닫았는지" 만 기록한다 — SSE 경로에 실제 allowlist 를 대칭 적용하는 코드
  변경은 diff 어디에도 없다(범위 확장 아님, 의도적 축소 기록).
- **`spec/5-system/14-external-interaction-api.md` 변경**은 CLAUDE.md 가 명시한
  "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 흐름을 그대로 따른
  것으로, `plan/in-progress/nodeoutput-allowlist.md` §작업의 "(planner 턴) EIA §R17 flip" 항목이
  이 커밋에 대응한다. 변경 폭도 R17 해당 불릿 1개 교체로 국한됐다.
- **`review/consistency/2026/08/23/18_30_40/**`(8개 신규 파일)** 은 CLAUDE.md 가 강제하는
  "구현 착수 직전 `consistency-check --impl-prep` 의무"의 정상 산출물이며 커밋 스코프 밖 작업이
  아니다.
- 두 번째 커밋(`c4356b367`)은 첫 커밋에서 발견한 vacuous 캐너리를 보강하는 테스트 전용 diff로,
  건드린 파일이 스펙/유틸 테스트 2개 + plan 문서 1개뿐이며 프로덕션 코드 변경이 전혀 없다 —
  테스트 강화가 별도 커밋으로 명확히 분리됨.

## 요약

두 커밋 모두 "`getStatus` 의 `nodeOutput` fail-open deny-list를 fail-closed allowlist로 전환"이라는
명시된 작업 범위에서 벗어나지 않는다. 소스 변경은 대상 함수(`allowlistNodeOutputKeys`)와 그 호출부
배선에 정확히 국한되고, import·주석·플랜 문서·spec 변경 전부가 이 기능과 직접 인과관계를 갖는다.
컴파일타임 타입 결속처럼 코드량이 늘어난 부분도 사전에 plan 에 설계로 명시됐고 consistency-check
피드백에 대한 직접 대응이라 scope creep 으로 보기 어렵다. 오히려 컨설턴시 체커가 "발견된 김에"
권고한 무관 오타 수정을 의도적으로 배제한 점, SSE/fanout 확장을 구현하지 않고 트래커 등재로만
남긴 점에서 범위 규율이 특히 엄격하게 지켜졌다. 포맷팅 전용 변경, 미사용 임포트, 설정 파일 변경,
무관 리팩토링은 발견되지 않았다.

## 위험도

NONE
