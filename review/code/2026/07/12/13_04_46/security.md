# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 순수 컴파일타임 상수 파생 리팩터 — 신규 리스크 표면 없음
  - 위치: `codebase/backend/src/modules/hooks/hooks.controller.ts:39-44` (`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MINUTES` 신설), `L86-90`(`res.set('Cache-Control', EMBED_CONFIG_CACHE_CONTROL)`), `L279-283`/`L299-301`(Swagger 문서 문자열)
  - 상세: 기존 리터럴 `300`/`'public, max-age=300'`/"5분"을 `EMBED_CONFIG_CACHE_SEC` 상수에서 파생한 `EMBED_CONFIG_CACHE_CONTROL`(`` `public, max-age=${EMBED_CONFIG_CACHE_SEC}` ``)와 `EMBED_CONFIG_CACHE_MAX_MINUTES`(`Math.ceil(EMBED_CONFIG_CACHE_SEC / 60)`)로 치환한 DRY 리팩터다. 두 상수 모두 사용자 입력·요청 컨텍스트와 무관한 고정 리터럴에서만 파생되며, 어떤 외부 입력도 문자열 조합에 개입하지 않는다(템플릿 리터럴/문자열 결합 모두 인젝션 벡터 없음). 렌더 결과는 리팩터 전후 byte-identical(`300초` = `5분`, `Math.ceil(300/60)=5`)이므로 응답 헤더·Swagger 문서 계약 자체는 변경되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 공개(`@Public()`) embed-config 엔드포인트의 fail-open/캐싱 설계는 본 diff 로 도입된 것이 아니라 기존 정책 유지
  - 위치: `hooks.controller.ts` `getEmbedConfig` (L304-312)
  - 상세: 인증 없는 공개 엔드포인트가 CDN/브라우저 캐시 가능한 응답(`Cache-Control: public, max-age=300`)을 반환하고, DB 조회 실패·트리거 미존재·인증 필요 webhook 모두 동일한 `{ allowlist: [], enforce: false }` 형태로 응답해 trigger 존재 여부를 노출하지 않는 설계(uniform response shape)는 이번 변경 이전부터 존재하던 것으로 diff 는 헤더 값의 **표현**만 상수화했을 뿐 이 정책의 **행동**을 바꾸지 않았다. 회귀 없음.
  - 제안: 조치 불필요(스코프 밖 — 필요 시 별도 검토).

- **[INFO]** 테스트 강화(`stringContaining` → 정확값 `'public, max-age=300'`)는 보안적으로 중립
  - 위치: `hooks.controller.spec.ts:104-107`
  - 상세: 단언을 느슨한 부분 문자열 매칭에서 정확값 매칭으로 강화한 것은 SoT(`EMBED_CONFIG_CACHE_SEC`) 드리프트 회귀를 잡기 위한 테스트 품질 개선이며, 보안 관련 로직·검증 경로에는 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음
  - 위치: 전체 diff(코드 3파일 + `review/code/2026/07/12/12_36_04/**`, `review/consistency/2026/07/12/12_56_04/**` 신규 리포트/상태 파일)
  - 상세: `api[_-]?key|secret|password|token|bearer|-----BEGIN|aws_|private_key` 패턴으로 전체 payload 를 스캔한 결과 매치 없음. `review/**` 하위에 새로 추가된 markdown 리포트·`meta.json`/`_retry_state.json` 등 상태 파일은 이전 리뷰/일관성 검토 세션의 감사 산출물(경로·타임스탬프·발견사항 텍스트)만 담고 있으며 시크릿·자격증명·개인정보는 포함되지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/hooks-embed-config-cache-ttl-doc-sot.md`, `review/code/**`, `review/consistency/**` 신규 파일은 문서/감사 산출물이며 실행 코드 경로 아님
  - 위치: 파일 3, 4~22
  - 상세: 인젝션·인증/인가·암호화·에러 처리 관점에서 검토할 실행 로직이 없다(정적 텍스트/JSON 상태 기록). `_retry_state.json`/`meta.json` 은 절대경로(로컬 worktree 경로)를 포함하나 이는 로컬 개발 환경 경로일 뿐 민감 정보(자격증명·내부 IP·프로덕션 엔드포인트)가 아니다.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `hooks.controller.ts` 의 embed-config 엔드포인트에서 `Cache-Control` 헤더 값(`public, max-age=300`)과 이를 서술하는 Swagger 문서 문자열이 여러 곳에 중복 하드코딩되어 있던 것을 두 개의 파생 상수(`EMBED_CONFIG_CACHE_CONTROL`, `EMBED_CONFIG_CACHE_MAX_MINUTES`)로 단일 진실화하는 behavior-preserving DRY 리팩터다. 사용자 입력·인증/인가 로직·데이터베이스 접근·암호화 경로에 대한 개입이 전혀 없고, 문자열 조합에 사용되는 모든 값이 컴파일타임 리터럴에서만 파생되어 인젝션 벡터가 존재하지 않는다. 테스트 강화(정확값 단언)도 보안 중립적인 회귀 가드 개선이다. 함께 커밋되는 `plan/`·`review/code/`·`review/consistency/` 하위 신규 파일들은 이전 리뷰/일관성 검토 세션의 감사 산출물(markdown 리포트, JSON 상태 파일)이며 시크릿·자격증명 노출이나 실행 가능한 보안 취약 경로를 포함하지 않는다. 공개 embed-config 엔드포인트의 fail-open·캐싱·uniform-response 설계는 이번 diff 이전부터 유지되던 기존 정책으로 회귀가 없다.

## 위험도
NONE
