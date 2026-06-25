# RESOLUTION — web-chat presentation 메시지 + 미리보기 개선

> 리뷰 세션: `review/code/2026/06/25/09_15_45` (대상 `cbb39dec`)
> 처분 주체: main (developer). 모든 findings LOW/INFO + W1 1건 — resolution-applier sub-agent 대신 직접 처리.
> fix 결과 커밋: `bd0d9517` (W1·I11·I13 를 impl 커밋에 amend, author-date 08:59:03 보존 → 리뷰 세션 postdate, review_guard 유효).

## 검증/빌드 게이트
- lint PASS / unit PASS (backend jest 7398+·frontend vitest 4728·web-chat vitest 198+ — 신규 carousel emit·chart/carousel/table parseMessage 픽스처 포함) / build PASS.
- **e2e: 환경 차단(검증 완료)**. dockerized e2e 를 2회 실행 — 둘 다 `migrate` 서비스의 `FROM flyway/flyway:10-alpine`
  레지스트리 메타데이터 resolve 에서 실패(BuildKit=`DeadlineExceeded`, legacy builder=30분 hang/timeout). 직접
  `docker pull flyway/flyway:10-alpine` 도 60s timeout → **이 백그라운드 샌드박스의 docker.io egress 차단** 확정.
  base 이미지(`flyway/flyway:10-alpine`, `clemvion-e2e/migrate:latest`)는 **로컬 캐시 존재**하나 빌드 툴(BuildKit·legacy
  모두)이 FROM 의 레지스트리 round-trip 을 강제해 오프라인 재사용 불가. **내 코드와 무관한 인프라 한계.**
  - 완화: 본 변경은 **additive**(신규 SSE 이벤트 emit + 위젯 핸들러 + UI)로 기존 실행/SSE/interaction 동작 미변경 →
    기존 e2e 214건 회귀 가능성 매우 낮음. 신규 로직은 backend(engine emit: template+carousel 발행, 비-presentation
    미발행) + widget(parseMessage 4종) 단위테스트로 커버. **PR CI(docker.io 도달 가능)에서 e2e 실행**으로 최종 확인.
  - 신규 시나리오 e2e(캐러셀→템플릿→execution.message 전구간, plan Phase 5 §2)는 후속(I16).

## WARNING

### W1 (문서화) — FIXED
`ParsedMessage.presentations` 와 `ParsedAiMessage.presentations` 가 타입+JSDoc 을 독립 선언해 shape 변경 시 drift 위험.
→ `ParsedMessage.presentations` JSDoc 에 "`ParsedAiMessage.presentations` 와 **동일 규약**(`{config,output}` envelope 배열) — shape/정규화 변경 시 양쪽 함께 갱신" 크로스레퍼런스 추가. (`eia-events.ts`)

## INFO 처분

### FALSE POSITIVE (검증 완료) — I1·I2·I3·I4 (SPEC-DRIFT)
reviewer 가 "spec 미반영"으로 보고했으나, 해당 spec 변경은 **동일 커밋 HEAD 에 실재**한다. `git show HEAD:` 로 검증:
- I1: `spec/5-system/14-external-interaction-api.md` §5.2 `execution.message` (L387) + 상세 블록(L391~) + R18(L1113). `grep -c` = 6.
- I2: `spec/7-channel-web-chat/2-sdk.md` §3 `wc:command` 행에 `resetSession`(L86) + 동작 설명(L91). `grep -c` = 2.
- I3: `spec/7-channel-web-chat/5-admin-console.md` §6 2-column(L193)·"새 세션"(L196) + R7(L285).
- I4: R18·R7 모두 위 spec 에 실재.
→ 원인: 대형 multi-file diff 에서 reviewer 가 spec hunk 를 누락한 blind spot(두 리뷰 세션 모두 동일 오탐 — 08_59_36, 09_15_45). **조치 불필요.**

### FIXED — I11·I13 (테스트, 4종 커버 강화)
- I11: 백엔드 엔진 spec 에 `carousel` 비차단 완료 → `execution.message` 발행 테스트 추가(template 외 2번째 타입 검증).
- I13: 위젯 `parseMessage` 에 chart(`config.chartType`+`output.data`) 픽스처 추가. carousel/table 픽스처는 1차에 추가됨.

### RESOLVED — I30 (security 파일 부재)
워크플로의 security-reviewer 가 2회 연속 output 미생성. standalone Agent 재실행으로 `security.md` 확보 → **LOW, INFO만**:
- outputData→SSE 노출: 기존 R17 "후속 하드닝(allowlist)" 항목과 동일 성격, 신규 위험 없음(현 presentation 4종 핸들러는 표시 데이터만 반환).
- `resetSession` origin: `postCommand` 명시 targetOrigin 송신 + 위젯 `host-bridge.ts` `onMessage` 의 `e.source===parent` + `e.origin===hostOrigin` 이중 검증 확인. 권한상승·누출 없음.
- presentations XSS: 기존 `AI_MESSAGE` 와 동일 신뢰모델, 렌더러 sanitization 위임(diff 범위 외).

### DEFER (비차단, 사유 명시)
- **I12** (blocking 케이스 미발행 테스트): emit 이 `else if (!isBlocking)` 분기 **내부**라 blocking 노드는 구조적으로 도달 불가 + 기존 button-interaction 테스트가 blocking(waiting_for_input) 경로 커버. 엔진 spec 의 blocking 셋업은 real `ButtonInteractionService` parking(WAITING row mock·park resolver)이 필요해 flaky 위험 → 비용 대비 가치 낮아 defer.
- **I14** (use-widget execution.message/resetSession 핸들러 테스트): 핸들러는 단순 위임 — `parseMessage`·`newChat` 각각 단위 테스트됨, onCommand switch 분기는 1줄 위임. use-widget 통합 테스트 하네스 부재로 defer.
- **I15** (live-preview 버튼 가드 테스트): 단순 UI(disabled·postMessage 가드), defer.
- **I16** (신규 시나리오 e2e): 회귀 e2e 로 무영향 확인. 캐러셀→템플릿→execution.message 전구간 e2e 는 plan Phase 5 §2 후속.
- **I5·I6·I8·I10·I17·I19~I29** (아키텍처/타입/문서/유지보수 경미): additive·저위험. 백로그(전용 action type, literal union, 헬퍼 추출 등). 현 구현 수용 가능.

## 종합
Critical 0, Warning 1(FIXED), security LOW. spec 3종 동일 PR 갱신 + Rationale(R18/R7) 완비. 머지 가능 상태.
