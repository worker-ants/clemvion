STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 대상 diff 요약

이번 변경(커밋 `45ba37792` 외 `spec/5-system/{11-mcp-client,14-external-interaction-api,2-api-convention}.md` 3파일 + `codebase/backend` 4파일)은 `token` 계열 값·키 두 축의 secret 마스킹 정규식을 통합하고, 그에 따른 spec 인용을 정정한 것이다. 신규 요구사항 ID, 신규 엔티티/DTO, 신규 API endpoint, 신규 이벤트명, 신규 ENV var, 신규 spec 파일 중 **어느 것도 새로 도입되지 않았다** — 아래는 관점별 확인 근거다.

## 관점별 확인

1. **요구사항 ID 충돌** — 없음. `EIA-NX-03`(문구만 수정, ID 불변), `R12`(캐비엇 단락만 추가) 등 기존 ID 를 재사용했을 뿐 신규 `EIA-*`/`WH-*`/`CCH-*` ID 가 부여되지 않았다.
2. **엔티티/타입명 충돌** — 없음. 코드 diff 는 `CREDENTIAL_KEY_PATTERN`(기존 상수, `sanitize-error-message.ts`·`websocket.service.ts` 두 자리 "의도된 미러" — 동일 이름 유지)과 `SECRET_LEAK_PATTERNS`(기존 상수)의 정규식 리터럴만 바꿨고, `MCP_EXTRA_SECRET_PATTERNS` 는 이름 그대로 두고 배열만 비웠다(신규 명 없음). spec 쪽에서 `hmacAlgorithm` 인용을 `AuthConfig.config.algorithm` 으로 정정했는데, 이는 **신규 필드 도입이 아니라 이미 `12-webhook.md §4.2`(`config.algorithm`, `HMAC-{config.algorithm}(...)`)에 확립된 기존 필드를 정확히 재인용**한 것이다(`spec/5-system/12-webhook.md:220-229` 참조) — 다른 의미로 겹치는 재사용이 아니다.
3. **API endpoint 충돌** — 없음. `2-api-convention.md §2.2` 에 추가된 표 행("예외 — 인증 family 전용 네임스페이스")은 `/api/external/{resource}` 를 **신규 endpoint 로 선언하지 않고** 이미 `14-external-interaction-api.md`(§R11, §2.3 시스템 전역 예외 표, §5.4)와 §6/§7 rate-limit 표에 존재하는 패턴을 URL 구조 규칙 절에 뒤늦게 명시한 것이다. "인증 family" 라는 표현도 같은 문서(`14-external-interaction-api.md:1155,1307`)에서 이미 쓰던 용어와 일치한다.
4. **이벤트/메시지명 충돌** — 없음. `§11` 표에 추가된 `execution.start` 행("WS 명령 §4.2 won't-do")은 신조어가 아니라 **같은 리포의 `6-websocket-protocol.md:821`** 에 이미 동일 문구("`execution.start` _(WS 명령 §4.2 won't-do)_ | (외부 미지원) | …")로 존재하는 매핑을 EIA 문서의 자매 표(§11)에 미러링한 것 — 두 "권위 표"가 어긋나 있던 것을 정정한 것이지 새 이벤트가 아니다. `execution.stop` 행도 마찬가지로 기존 명령명 재사용.
5. **환경변수·설정키 충돌** — 없음. 신규 ENV var 나 config key 도입 없음. 정규식 리터럴 변경만 있고 상수/설정 키 이름은 그대로다.
6. **파일 경로 충돌** — 없음. `git diff origin/main...HEAD --name-status` 로 확인한 결과 이번 diff 에 포함된 8개 파일(spec 3 + backend 5, test 파일 2 포함) 전부 `M`(modify) 이며 `A`(add)/`R`(rename) 은 0건 — 신규 spec 파일·신규 소스 파일 경로가 생성되지 않았다.

## 참고로 확인한 잠재 이슈 (범위 외)

`[A-Za-z0-9_-]*token` 확장 정규식이 `nextPageToken`(불투명 커서) 같은 무해한 키도 마스킹하는 **의도된 오탐**은 diff 자체에 캐너리 테스트(`sanitize-error-message.spec.ts` "[캐너리] 불투명 커서도 마스킹된다")로 명시적으로 기록돼 있다. 이는 마스킹 동작의 트레이드오프이지 신규 식별자가 기존 식별자와 다른 의미로 충돌하는 사안이 아니어서 본 관점(신규 식별자 충돌) 밖으로 판단해 findings 에 올리지 않았다.

### 발견사항

없음.

### 요약

이번 PR 은 `token` 계열 secret 마스킹 정규식(값 축·키 축)을 세 자리(`sanitize-error-message.ts` 값/키 패턴, `websocket.service.ts` 키 패턴)에서 통합하고 `mcp-error-codes.ts` 의 잉여 대안을 흡수 제거했으며, 그에 맞춰 `spec/5-system/{11-mcp-client,14-external-interaction-api,2-api-convention}.md` 세 곳의 인용·표를 정정한 순수 정합화 작업이다. 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·spec/코드 파일 경로 중 어느 것도 새로 만들어지지 않았고, spec 표에 새로 추가된 행("인증 family 전용 네임스페이스", `execution.start` WS 매핑, `AuthConfig.config.algorithm` 출처 정정)은 모두 같은 문서군 안에 이미 확립돼 있던 식별자·용어를 재사용하거나 정확히 재인용한 것이라 충돌 소지가 없다.

### 위험도
NONE
