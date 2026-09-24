# Rationale 연속성 검토 — spec/5-system (--impl-prep)

## 검토 범위와 한계

target 은 "구현 대상 영역 `spec/5-system`" 번들이었으나, 실제로 **전문이 포함된 것은
`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 파일뿐**이다. 나머지
`4-execution-engine.md`·`5-expression-language.md`·`6-websocket-protocol.md`·
`7-llm-client.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·
`11-mcp-client.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·
`15-chat-channel.md`·`16-system-status-api.md`·`17-agent-memory.md`·`_product-overview.md`
15개와, `spec/` 트리의 대다수 문서(2-navigation 대부분·3-workflow-editor·4-nodes·
6-brand·7-channel-web-chat·data-flow 전부)는 "컨텍스트 예산 초과로 생략" 상태였다.
아래 결론은 **전문이 주어진 3개 문서 + 함께 전달된 Rationale 발췌
(`0-overview.md`·`1-data-model.md`·`2-navigation/1-workflow-list.md`·
`2-navigation/2-trigger-list.md`·`2-navigation/3-schedule.md`)** 범위로 한정된다.

이번 작업(`plan/in-progress/nestjs-v12-coordinated-upgrade.md`)은 `spec_impact: none` —
spec 을 바꾸는 작업이 아니라 `@nestjs/*` 의존성 범프이므로, 이 검토의 "target" 은
**신규/변경 초안이 아니라 현재 merge 된 spec 원문**이다. 따라서 여기서 찾을 수 있는 것은
"이 upgrade 가 새로 도입한 rationale 위반" 이 아니라 "기존 spec 원문 자체가 이미 품고 있는
연속성 결함" 이다.

## 발견사항

전문이 주어진 세 문서(`1-auth.md`의 자체 `## Rationale`, `2-api-convention.md`의 자체
`## Rationale`, `3-error-handling.md`의 자체 `## Rationale`)와 교차 검토한 외부 Rationale
발췌 사이에서 **기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회에 해당하는
CRITICAL/WARNING 사례를 찾지 못했다.** 이 세 문서는 이례적으로 자기 검증적이다 — 각
결정에 실측(`git log -S`, 실제 컬럼 유무, 코드 grep 결과)을 동봉하고, 번복 시 반드시 새
Rationale 항목을 만들며(`1.4.D`→로그인 TOTP 자동 fallback 금지, `2.3.D`→재인증 흐름
정합화, `ACCOUNT_LOCKED` 423→401 정정 등), 이미 기각한 대안이 다른 이름으로 재등장할 때
그것을 스스로 지적하는 방어 문구까지 두고 있다(`1-data-model.md` "User 민감 컬럼 방어" 항목의
"`select: {...}` 를 1행이 기각한 대안의 재도입으로 오판할 수 있다" 경고, `1-auth.md` "부트
캐너리" 항목의 "SetMetadata + Reflector opt-in 마커 — 재기각이다").

- **[INFO]** 이번 upgrade 작업이 실제로 건드리는 유일한 load-bearing invariant는 확인됨 —
  재기각 대상이 아니라 준수 대상
  - target 위치: `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection
    자가검증"(§2.3 인근, `## Rationale` 하단)
  - 과거 결정 출처: 동일 spec 파일의 같은 항목 — "`SetMetadata` + `Reflector` opt-in
    마커로 가지 않았는가 — 재기각이다" (data-flow §Rationale "멤버십 검증은 가드
    1곳에서" 가 이미 기각한 라우트별 opt-in 마커 패턴을 다시 기각)
  - 상세: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 는 이 캐너리(라우트 소비
    수)와 `RolesGuard`/`@WorkspaceId()` 가 Nest 비공개 API(`ROUTE_ARGS_METADATA`)에
    의존하는 fail-open 성질을 정확히 인용하며, 업그레이드 전/후 소비 라우트 수(142건)와
    뮤테이션 테스트(9개 RED) 기준값을 이미 실측해 뒀다. 이는 rationale 위반이 아니라
    **rationale 이 정한 caveat("전체 파손만 잡고 부분 파손은 못 잡는다")을 정확히 인지한
    실행 계획**이다 — 오히려 continuity 를 지키는 모범 사례로 기록해 둔다.
  - 제안: 조치 불요. 다만 §C 검증에서 소비 라우트 수가 142 에서 달라지면(구조 변경이 아니라
    단순 수 변화라도) 그 원인이 "Nest 내부 메타데이터 포맷 변경"(캐너리 항목이 이미 예견한
    파손 시나리오 (1))에 해당하는지 반드시 규명하고, 규명 결과를 캐너리 rationale 이 아니라
    이번 plan 문서 쪽에 남길 것 — spec 쪽 rationale 은 "구체 수치는 여기 적지 않는다" 원칙을
    이미 명시했으므로 그 원칙을 어기지 않아야 한다.

- **[INFO]** 검토 범위 밖 15개 파일에는 이 결론이 미치지 않음
  - target 위치: `spec/5-system/4-execution-engine.md`·`6-websocket-protocol.md`·
    `14-external-interaction-api.md` 등 (본문 생략)
  - 상세: `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 세 문서가 반복적으로
    이 세 파일을 SoT 로 참조한다(예: `SERVER_SHUTTING_DOWN` 503 선례, WS 재연결 §6.1/§6.2,
    EIA §5.1 에러 표). 이번 upgrade 가 실행 엔진의 continuation 재개·WS 인증·EIA 토큰
    검증 경로(가드·데코레이터 밀집 구역)에 실제로 손대게 된다면, 이 checker 가 못 본 세
    파일의 자체 Rationale(특히 `4-execution-engine.md §Rationale`)을 별도로 대조할 필요가
    있다.

## 요약

전문이 제공된 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 와 함께 전달된 외부
Rationale 발췌(`0-overview.md`·`1-data-model.md`·`2-navigation/1~3`) 사이에서 기각된
대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 어느 유형의 CRITICAL/WARNING
도 발견하지 못했다. 이 spec 영역은 결정 변경 시 실측과 새 Rationale 항목을 동반하는
관행이 정착돼 있고, 이번 nestjs12 업그레이드 plan 자체도 유일하게 관련된 invariant(부트
캐너리 reflection 가드)의 caveat 를 정확히 인용해 사전 대응하고 있다. 다만 검토 대상이
컨텍스트 예산으로 인해 `spec/5-system` 의 3/18 파일과 `spec/` 트리 대부분에 대한 전문
접근 없이 이뤄졌으므로, 이 결론은 그 범위에 한정된 것으로 읽어야 한다.

## 위험도

LOW
