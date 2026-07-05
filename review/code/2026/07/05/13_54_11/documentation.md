# 문서화(Documentation) 리뷰 — SSRF 에러 메시지 일반화 (재검토, 13_54_11)

대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`http-request.handler.spec.ts`, 및 선행 리뷰 세션 산출물
(`review/code/2026/07/05/13_32_17/*`, `review/consistency/2026/07/05/12_55_17/*`),
관련 spec (`spec/4-nodes/4-integration/1-http-request.md`,
`spec/4-nodes/4-integration/2-database-query.md`, `spec/2-navigation/4-integration.md`,
`spec/5-system/2-api-convention.md`).

본 세션은 직전 문서화 리뷰(`13_32_17/documentation.md`)가 WARNING 2건(코드 JSDoc·spec §8.3/§6
"Usage 로그에도 원본이 남는다" stale 서술)을 지적한 뒤의 fix 커밋을 재검토하는 라운드다.

## 발견사항

- **[INFO] 직전 라운드 WARNING#1·WARNING#2(stale JSDoc/spec 문구) 해소 확인**
  - 위치: `http-request.handler.ts:27-34`(`SSRF_BLOCKED_CLIENT_MESSAGE` JSDoc),
    `spec/4-nodes/4-integration/1-http-request.md` §6 표(`HTTP_BLOCKED` 행) 및 §8.3 Rationale
  - 상세: 코드 JSDoc 은 이제 "usage 로그(`IntegrationUsageLog`)는 Activity API로 workspace
    사용자에게 raw 반환되므로 거기에도 이 일반화 문구를 기록한다"로 정확히 서술하며, 실제 구현
    (L372-380 preflight logUsage, L296 redirect-hop 승격 후 outer catch logUsage)과 일치한다.
    spec §6 표·§8.3 본문도 "Usage 로그도 일반화 (§8.3)" / "**Usage 로그… 거기에도 일반화 메시지를
    기록해 정찰 면을 넓히지 않는다**"로 동일하게 정정되었다. `2-database-query.md` Rationale 도
    "HTTP Request(`HTTP_BLOCKED`)도 2026-07-05 동일 일반화 완료"로 갱신되고 §8.3 앵커로
    cross-reference가 걸려 DB↔HTTP 문서 정합이 유지된다. 코드-스펙 간 stale 불일치는 해소됨 —
    조치 불요, 확인 목적의 기록.
  - 제안: 없음.

- **[INFO] 신규 테스트(redirect-to-internal-host, redirect 5홉 초과) 주석은 정확하고 구현과 일치**
  - 위치: `http-request.handler.spec.ts:1064-1139` (redirect SSRF 차단 2개 신규 `it` 블록)
  - 상세: `Logger.prototype.warn` spy 로 원본 host/IP(`169.254.169.254`)가 서버 로그에만 보존됨을
    단언하고, `logUsage`·`output.error.message` 양쪽에서 일반화 문구만 포함됨을 검증한다. 인라인
    주석("원본 host/IP 는 서버 로그(logger.warn)에만 보존된다", "usage 로그(Activity API 노출)는
    일반화 — 원본 미포함")이 실제 코드 동작과 정확히 일치한다. 조치 불요.
  - 제안: 없음.

- **[INFO] (직전 라운드에서 이미 INFO로 확인, 잔존) `1-http-request.md` §8.3 "breaking" 콜아웃이
  §8.2 내용 재사용으로 보여 오독 소지**
  - 위치: `spec/4-nodes/4-integration/1-http-request.md:1950`(§8.3 마지막 문단)
  - 상세: §8.3(메시지 일반화 + redirect 오분류 정정)은 차단 여부 자체를 바꾸지 않는데도 문단
    마지막에 §8.2 가 도입한 "`none`/`custom` 사설 대상 차단" breaking 경고가 그대로 반복돼,
    "이번 변경으로 새로 차단되는 케이스가 생겼다"는 오독을 유발할 여지가 여전히 남아있다.
    이번 재검토 라운드에서도 수정되지 않았다.
  - 제안: 필수는 아님(INFO). "본 절 자체는 차단 여부를 바꾸지 않으며, §8.2 breaking 변경은 그대로
    유지된다(메시지 문구·라우팅만 정정)"는 한 문장 추가를 고려.

- **[INFO] (직전 라운드 INFO, 잔존) `logger.warn` 태그 접두어가 redirect-limit 지점에서
  preflight 와 동일 — 로그만으로 구분 어려움**
  - 위치: `http-request.handler.ts:440-441`(`'SSRF block (http-request): redirect chain exceeded 5 hops'`)
    vs `:367`(preflight, 동일 접두어) vs `:457`(redirect-hop, `(http-request redirect)` 접두어로 구분됨)
  - 상세: maintainability 리뷰(13_32_17)가 지적한 로그 태그 비대칭이 이번 커밋에서도 그대로다.
    redirect 한도 초과 로그(L441)만 preflight 와 동일한 `(http-request)` 태그를 쓰고, redirect-hop
    재검증 실패 로그(L457)는 `(http-request redirect)` 로 구분된다. 문서화 관점에서는 코드 자체보다
    "로그 텍스트가 실제 발생 경로를 정확히 서술하는 주석/문구인가"의 문제이며, 3곳 중 1곳만 태그가
    어긋나 있어 사후 로그 분석 시 redirect-limit 초과와 preflight 차단을 구분하기 어렵다.
  - 제안: 우선순위 낮음(INFO, maintainability 영역과 중복). `'SSRF block (http-request redirect-limit): ...'`
    로 통일하면 세 로그 지점이 모두 구분 가능해진다.

- **[INFO] README/CHANGELOG/환경변수 신규 문서화 불필요 확인**
  - 상세: 이번 변경은 기존 `ALLOW_PRIVATE_HOST_TARGETS` 플래그를 재사용하며 신규 환경변수·설정
    옵션·공개 API 엔드포인트를 추가하지 않는다. 최상위 README 갱신·CHANGELOG 항목 추가가 필요한
    변경은 아니다(리포지토리에 최상위 CHANGELOG 관례 자체가 없음, spec Rationale 섹션이 그 역할 대체).
  - 제안: 없음.

- **[INFO] `review/code/2026/07/05/13_32_17/*` 리뷰 산출물은 재검토 대상이 아닌 이력 기록**
  - 상세: `RESOLUTION.md`·`SUMMARY.md`·`_retry_state.json`·개별 reviewer `.md` 파일들은 이번 diff에
    신규 생성된 리뷰 세션 산출물로, `.claude/docs` 관례상 review 산출물은 그 자체로 문서 갱신
    의무 대상이 아니다(코드/spec 문서화 상태를 평가하기 위한 근거 자료로만 참조). 내용도 실제
    코드·spec 최종 상태와 정합적이다.
  - 제안: 없음.

- **[INFO] `spec/5-system/2-api-convention.md` 앵커 오타 수정은 SSRF 작업과 무관하나 정확**
  - 위치: `spec/5-system/2-api-convention.md:1998-1999`
  - 상세: `#...-datitems-...` → `#...-dataitems-...` 마크다운 앵커 slug 오타 수정. 문서 링크
    무결성 향상이며 이번 스코프 documentation 관점에서 문제 없음.
  - 제안: 없음(가능하면 커밋 메시지에 스코프 외 변경으로 별도 언급 권장 — 우선순위 낮음).

## 요약

직전 라운드(13_32_17)에서 documentation reviewer 가 WARNING 등급으로 지적한 핵심 문제 —
코드 JSDoc과 spec §6/§8.3 본문이 "Usage 로그에도 원본 host/IP가 남는다"고 실제 구현과 다르게
서술하던 stale 문구 — 는 이번 커밋에서 코드·spec 양쪽 모두 정확하게 정정되어 완전히 해소되었다.
`2-database-query.md` cross-reference 갱신, 신규 redirect 테스트의 인라인 주석 정확성도 실제 동작과
일치한다. 남은 항목은 모두 직전 라운드에서 이미 INFO로 분류된 저위험 잔존 사항(§8.3 breaking 콜아웃
문구의 잠재적 오독 소지, redirect-limit 로그 태그 접두어 비일관)뿐이며 이번 재검토에서 새로운
문서화 결함은 발견되지 않았다.

## 위험도

NONE
