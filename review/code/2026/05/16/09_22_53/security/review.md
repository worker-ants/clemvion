# 보안(Security) 코드 리뷰

세션: `review/code/2026/05/16/09_22_53`
리뷰어: security
대상 파일: `Makefile`, `backend/src/modules/integrations/third-party-oauth.controller.spec.ts`, `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`

---

### 발견사항

이번 변경 범위는 다음 4개 파일로 한정된다.

1. `Makefile` — `e2e-up`, `e2e-test`, `e2e-test-full` 타겟에 `--build` 플래그 추가
2. `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` — TypeScript 타입 좁히기 lint 수정
3. `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — 작업 추적 plan 문서 신규 추가
4. `review/consistency/2026/05/16/09_13_51/SUMMARY.md` — consistency-check 결과 문서 신규 추가

---

#### Makefile 분석

- **[INFO]** `--build` 플래그 추가 자체는 보안 영향 없음
  - 위치: `Makefile` L39–L62
  - 상세: `docker compose ... up -d --wait --build backend-e2e` 및 `run --rm --build ...` 변경은 Docker BuildKit 레이어 캐시를 활용한 재빌드를 강제한다. 커맨드 인젝션 가능성을 검토했으나, `$(COMPOSE_E2E)`, `$(MAKE)` 모두 Makefile 내부 변수이며 외부 입력이 주입되는 경로가 없다. `STATUS=$$?` 패턴은 셸 변수 참조로 안전하다.
  - 제안: 현재 구현에 보안 취약점 없음. 추가 조치 불필요.

- **[INFO]** 커맨드 인젝션 경로 부재 확인
  - 위치: `Makefile` 전체 diff
  - 상세: Makefile 타겟 인자는 환경 변수나 사용자 입력을 직접 받지 않으므로 커맨드 인젝션 위험이 없다. `; STATUS=$$?; $(MAKE) e2e-down; exit $$STATUS` 패턴은 종료 코드 전달 목적의 의도적 구성으로 비정상적 흐름 제어 가능성 없음.
  - 제안: 이상 없음.

---

#### third-party-oauth.controller.spec.ts 분석

- **[INFO]** 타입 좁히기 수정 — 보안 관련 영향 없음
  - 위치: `backend/src/modules/integrations/third-party-oauth.controller.spec.ts` L85–L88
  - 상세: `Record<string, unknown>` → `Record<string, string>` 타입 변경 및 `String(contentType ?? '')` → `contentType ?? ''` 단순화는 순수 TypeScript 타입 정합성 수정이다. 테스트 코드 내부에서만 사용되며 런타임에 어떤 입력도 외부로 노출되지 않는다.
  - 제안: 이상 없음.

- **[INFO]** 테스트에서 에러 바디 내용 검증 (`CAFE24_INSTALL_INVALID_TOKEN`, `token gone`) 확인
  - 위치: `third-party-oauth.controller.spec.ts` L89–L91 (변경 외 주변 컨텍스트)
  - 상세: `bodyStr.toContain('CAFE24_INSTALL_INVALID_TOKEN')` 및 `'token gone'` 은 테스트에서 에러 응답 본문 내용을 검증하는 assertion이다. 이 값들이 실제 프로덕션 응답에 그대로 노출되는지는 이번 diff 범위 밖이나, 에러 메시지에 내부 토큰 식별자가 포함되는 패턴은 정보 노출(OWASP A09) 관점에서 주의가 필요하다. 이번 변경이 이 부분을 추가·변경한 것은 아니므로 INFO 등급으로 기록한다.
  - 제안: 실제 응답 핸들러(`ThirdPartyOAuthController`)에서 에러 메시지 내용이 사용자에게 전달되는 범위를 별도 리뷰 시 확인할 것. 이번 diff 변경 자체는 무해하다.

---

#### plan 문서 및 consistency 문서 분석

- **[INFO]** plan/review 마크다운 문서 — 보안 관련 내용 없음
  - 위치: `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md`, `review/consistency/2026/05/16/09_13_51/SUMMARY.md`
  - 상세: 두 문서는 작업 추적 및 검토 기록 목적의 내부 문서이다. 하드코딩된 시크릿, API 키, 비밀번호, 토큰 등이 포함되어 있지 않다. `docker inspect clemvion-e2e-backend-e2e:latest` 명령과 이미지 이름이 포함되어 있으나, 이는 내부 개발 환경 식별자로 외부에 노출될 경우 경미한 정보 수집에 활용될 수 있는 수준이며 공개 저장소 여부에 따라 관리 수준을 조정하면 된다.
  - 제안: 이상 없음.

---

### 요약

이번 변경은 Docker e2e 빌드 환경의 stale 이미지 문제를 해소하기 위해 `Makefile`에 `--build` 플래그를 추가하고, TypeScript lint 오류를 수정한 최소 범위의 패치다. 보안 관점에서 커맨드 인젝션, 하드코딩된 시크릿, 인증/인가 로직 변경, 입력 검증 누락, 암호화 알고리즘 변경 등 어떠한 취약 요소도 도입되지 않았다. 유일한 관찰 사항은 테스트 코드에서 에러 응답 바디 내용(`CAFE24_INSTALL_INVALID_TOKEN`, `token gone`)을 검증하는 패턴인데, 이는 기존 코드에 이미 존재하던 것으로 이번 diff에서 변경되지 않았다. 실제 프로덕션 에러 응답에 동일한 내부 식별자가 노출되는지는 별도 리뷰 시 확인을 권장한다.

### 위험도

NONE
