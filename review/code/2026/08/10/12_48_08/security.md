# 보안(Security) Review

## 대상

- `codebase/channel-web-chat/src/widget/use-widget.ts` — `openStream()` 반환 타입을 이전 라운드(`12_39_25`)의 `boolean`에서 명명 union `StreamClaim`(`"opened" | "already_owned" | "no_client"`)으로 승격. SSE 스트림 소유권 게이트(`streamRef.current !== null` 검사)가 함수 진입부에 있는 구조 자체는 이전 라운드와 동일하며, 이번 diff는 반환값의 타입 표현만 바꾼다. 호출부(`start()`, `applyConfig` 복원)도 `if (openStream(...) === "already_owned") return;` 로 함께 갱신.
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 회귀 테스트 위 주석을 "호출부 양쪽 게이트" 서술에서 "openStream 내부 단일 게이트" 서술로 갱신(코드 변경 없음, assertion 불변).
- `plan/in-progress/webchat-usewidget-extraction.md` — 위 작업을 완료 항목으로 체크(문서만).
- `review/code/2026/08/10/12_39_25/*` — 이전 라운드(boolean 버전 리뷰)의 SUMMARY/RESOLUTION/각 reviewer 리포트 + 상태 파일을 저장소에 신규 커밋. 산출물 텍스트이며 런타임 코드 아님.

## 발견사항

리뷰 대상 diff 범위 내에서 **CRITICAL/WARNING 급 보안 결함은 발견되지 않았다.**

- **[INFO]** `boolean` → 명명 union 승격이 보안 관점에서도 완만한 개선
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:104-110`(`type StreamClaim` 정의), `:386-409`(`openStream` 구현), `:619`(`start()` 호출부), `:968`(`applyConfig` 복원 호출부)
  - 상세: 이전 라운드는 `openStream`이 "client 미확립"과 "실제로 열었다"를 같은 `true`로 뭉개는 `boolean`을 썼다(그 라운드 security 리뷰는 이를 INFO로 "도달 불가능한 방어 분기"라 판단해 NONE 처리). 이번 diff는 세 상태(`"opened"`/`"already_owned"`/`"no_client"`)를 서로 다른 리터럴로 분리해, 호출부가 오직 `"already_owned"`만 중단 조건으로 비교(`=== "already_owned"`)하도록 명시했다. 이 자체가 새 취약점을 막는 것은 아니지만(이미 이전 라운드 리뷰가 boolean 버전도 안전하다고 결론), 향후 세 번째 seed→openStream 호출부가 추가되거나 `StreamClaim`에 네 번째 상태가 생길 때 TypeScript의 exhaustiveness 체크(예: `switch`/명시적 비교)가 "새 상태를 진행으로 잘못 분류"하는 실수를 컴파일 시점에 잡아줄 여지가 `boolean`보다 크다 — 이 코드베이스가 반복해서 낸 "비대칭 가드"(예: 세션 탈취/스트림 교체) 결함 클래스의 재발 표면을 조금 더 좁힌다.
  - 제안: 조치 불필요(개선). 다만 호출부가 `!== "already_owned"`가 아니라 `=== "already_owned"`로 정확히 비교하는 패턴(오늘 코드가 그렇게 함, gate 619·968)을 앞으로도 유지할 것 — `!==` 방향으로 실수하면 `"no_client"`/`"opened"`를 중단으로 오분류하는 회귀가 생긴다(다만 union이 리터럴 3종뿐이라 오타 시 TS 가 `never` 좁히기로 잡아줄 여지도 있다).

- **[INFO]** `"no_client"` 진행 분기는 이전 라운드에서 이미 검토·승인된 의도된 동작 보존이며 이번 diff로 도달 가능성이 달라지지 않았다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:389`(`if (!client) return "no_client";`)
  - 상세: 이전 라운드 security 리뷰(`review/code/2026/08/10/12_39_25/security.md`)가 이미 이 분기를 "실무상 도달 불가능한 방어적 코드이며 공격자가 `clientRef.current`를 null로 만들 외부 입력 경로가 없다"고 확인했다. 이번 diff는 반환값의 표현만 `true` → `"no_client"`로 바꿨을 뿐 도달 조건·호출부 배선을 바꾸지 않았으므로 그 결론이 그대로 유지된다.
  - 제안: 조치 불필요. RESOLUTION.md(§조치하지 않은 것)에 이미 이 판단이 기록되어 있다.

- **[INFO]** 리뷰 산출물(`review/code/2026/08/10/12_39_25/*.md`, `_retry_state.json`, `meta.json`)이 로컬 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)를 다수 포함한 채 커밋됨
  - 위치: `review/code/2026/08/10/12_39_25/_retry_state.json` 전체, `review/code/2026/08/10/12_39_25/SUMMARY.md`·`RESOLUTION.md` 등
  - 상세: 자격증명·토큰·API 키 등 시크릿은 없다. 다만 로컬 파일시스템 경로(사용자명은 포함되지 않음, `/Volumes/project/private/clemvion/...` 형태)가 노출되는데, 이는 이 저장소의 기존 관례(다른 세션들의 `_retry_state.json`도 동일 패턴)와 일치하고 CLAUDE.md가 정의한 `review/code/**` 산출물 저장 위치 규약을 따른 것이라 신규 리스크로 보지 않는다.
  - 제안: 조치 불필요(기존 컨벤션 부합, 정보성 기록).

## 점검 관점별 요약

1. **인젝션**: 해당 없음. SQL/커맨드/경로 조작 입력 처리 코드 변경 없음. `session.endpoints`/`session.token`을 `EiaClient.openStream`에 그대로 전달하는 기존 배선 유지, 신규 사용자 입력 경로 없음.
2. **하드코딩된 시크릿**: 없음. 리뷰 산출물에도 시크릿·토큰·키 노출 없음(로컬 경로만).
3. **인증/인가**: `openStream` 반환 타입 변경은 SSE 소유권(세션 라이프사이클) 게이트의 **표현**만 바꾼 것으로, 토큰 검증·origin allowlist 등 실제 인증/인가 로직은 diff 범위 밖이며 손대지 않았다. 이전 라운드가 이미 확인한 "게이트를 호출부 복제에서 내부 강제로 이동"이라는 구조적 개선은 이번 diff에서도 그대로 유지된다(퇴행 없음).
4. **입력 검증**: 변경 범위 밖(`safeApiBaseFromQuery`, `isEmbedAllowed` 등은 컨텍스트로만 포함).
5. **OWASP Top 10**: 특별한 해당 항목 없음.
6. **암호화**: 해당 없음.
7. **에러 처리**: `openStream`은 에러를 던지지 않으며 반환값 표현만 바뀌었다. `onError` 콜백의 `console.warn`(CORS 힌트 노출)은 diff 범위 밖(unchanged context)이며 이번 라운드가 새로 도입하지 않았다.
8. **의존성 보안**: 신규 의존성 추가 없음.

## 요약

이번 diff는 이전 라운드(`12_39_25`)에서 이미 "CRITICAL/WARNING 없음, NONE 위험도"로 판정된 SSE 스트림 소유권 게이트 리팩터를 한 단계 더 다듬은 것으로, `openStream`의 반환 타입을 `boolean`에서 명명 union `StreamClaim`으로 승격하고 그에 맞춰 호출부 비교식·테스트 주석·plan 문서를 갱신했다. 게이트의 위치·타이밍(동기적 check-then-act, `client.openStream` 호출 전 소유권 확인)은 이전 라운드와 동일하게 유지되어 새로운 race window나 인증/인가 우회 경로를 만들지 않으며, `"no_client"` 진행 분기도 이전 라운드에서 이미 "도달 불가능한 방어 코드·동작 보존"으로 확인된 내용 그대로다. 신규 인젝션·하드코딩 시크릿·안전하지 않은 암호화·민감정보 에러 노출은 발견되지 않았고, 함께 커밋된 이전 라운드 리뷰 산출물에도 시크릿 노출은 없다(로컬 경로만 포함, 기존 컨벤션 부합). 오히려 union 타입 승격은 향후 세 번째 상태가 추가될 때 컴파일러가 미처리 분기를 잡아줄 여지를 늘려, 이 파일이 반복해 온 "가드를 한쪽에만 적용" 결함 클래스의 재발 표면을 소폭 더 줄이는 방향이다.

## 위험도

NONE
