# Rationale 연속성 검토 — spec/5-system/ (avatar-upload-public-url)

## 조사 방법

- target 델타(2개 파일: `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`)를
  `git diff origin/main...HEAD --` 로 직접 재확인.
- 두 파일의 `## Rationale` 절 전문과, 번들에 함께 실린 관련 spec(`spec/0-overview.md`,
  `spec/2-navigation/9-user-profile.md`, `spec/data-flow/0-overview.md`,
  `spec/data-flow/4-file-storage.md`, `spec/1-data-model.md` 등)의 `## Rationale` 발췌를 대조.
- 핵심 쟁점(§9 파일 업로드 절이 "아바타는 별도 업로드 엔드포인트 없음" → "업로드 엔드포인트 신설"로
  뒤집힌 부분)에 대해 `git log -S`/`git show` 로 원 문장의 출처(커밋 `cfffc1355`, 2026-06-03 코드정합성
  동기화)를 추적해, 그것이 "기각된 대안"인지 "당시 코드 상태를 반영한 사실 서술"인지 판별.
- 구현 diff(15파일/1977줄, S3 public-base-url 설정·`UsersService.updateAvatar`·e2e)를 대조해 target
  spec 문구(2MB, `avatars/{userId}/{uuid}.{ext}`, `FILE_REQUIRED`/`INVALID_FILE_TYPE`, 413 재사용)가
  실제 코드·테스트와 일치하는지 확인.

## 발견사항

### INFO — §7 Rate Limiting 표에 아바타 업로드 엔드포인트 행 부재

- target 위치: `spec/5-system/2-api-convention.md` §7 (표는 이번 diff 로 변경되지 않음, §9 만 변경됨)
- 과거 결정 출처: 같은 문서 §7 상단 각주 "**표의 범위**: 위 표는 글로벌 throttler tier 와 ... 주요
  endpoint-specific 오버라이드를 **cross-cutting SoT** 로 정리한 것" — 그 원칙에 따라 "파일 업로드
  (KB 문서)" 행이 이미 "별도 `@Throttle` 없음(글로벌 100 req/min 상속)"이라는 **무-오버라이드 사실**까지
  명시적으로 등재돼 있음.
- 상세: 이번 PR 이 §9 에 두 번째 파일 업로드 엔드포인트(`POST /api/users/me/avatar`)를 신설했지만, 구현
  diff 상 `uploadAvatar` 에는 전용 `@Throttle` 이 없어 KB 문서 업로드와 동일하게 글로벌 tier 를 상속한다
  (grep 으로 확인, 전용 데코레이터 없음). §7 표의 자체 원칙("주요 업로드 표면은 오버라이드 유무와 무관하게
  행으로 등재")을 그대로 적용하면 이 엔드포인트도 KB 문서 행과 대칭으로 한 행을 받아야 하는데, 이번 diff
  는 §9 만 갱신하고 §7 은 그대로 뒀다. Rationale 을 뒤집거나 원칙을 위반한 것은 아니고(값 자체는 여전히
  글로벌 100/min 로 맞음), 그 원칙이 요구하는 **가시성 등재를 누락**한 completeness gap 에 가깝다.
- 제안: §7 표에 "파일 업로드 (아바타)" 행을 KB 문서 행 옆에 추가(예: "글로벌 100 req/min 상속 —
  `POST /api/users/me/avatar` 에 별도 `@Throttle` 없음"). Rationale 정정은 불필요 — 표 갱신만으로 충분.

## 결론적으로 CRITICAL/WARNING 없음 — 확인한 잠재 충돌과 그 결과

아래는 "충돌처럼 보였으나 조사 결과 Rationale 연속성 위반이 아님"으로 판정한 항목들이다(발견사항으로
등재하지 않지만 검토 과정을 투명히 남긴다).

1. **"아바타는 별도 업로드 엔드포인트 없음" 문구의 반전** — `2-api-convention.md` §9 가 이번 diff 로
   "유저 아바타는 multipart 업로드가 아니라 `avatarUrl` URL 필드로 관리한다(별도 업로드 엔드포인트
   없음)"을 "파일 업로드 엔드포인트는 둘이다 ... 아바타 업로드"로 바꿨다. 이 문장은 `## Rationale`
   에서 나온 것이 아니라 커밋 `cfffc1355`(2026-06-03, "전수 코드정합성 동기화")가 **그 시점의 코드
   상태를 그대로 반영**해 넣은 사실 서술이다(`git log -S`로 원 출처 확인, 그 커밋 어디에도 "URL 필드가
   업로드보다 낫다"는 근거 문단이 없다). 즉 이것은 기각된 *대안*이 아니라 "당시엔 없었다"는 관찰이었고,
   이번 PR 은 그 관찰을 무효화하는 신규 기능을 스펙에 반영한 것뿐이다. 결정 번복에 해당하는 새 Rationale
   (아바타 공개 URL 서빙 결정 — 2026-08-31 사용자 결정)이 `spec/0-overview.md` §2.7 Rationale·
   `spec/data-flow/4-file-storage.md` Rationale·`spec/2-navigation/9-user-profile.md` §6.1 에 이미
   나란히 추가돼 있어 규칙 3("결정의 무근거 번복") 요건을 충족한다.
2. **워크스페이스 격리 우회** — Avatar 키가 `workspaceId` prefix 를 갖지 않고 공개 버킷에서 서빙되는
   것은 `spec/0-overview.md` Rationale "S3 객체 키 prefix 설계"가 KB 문서와 별도로 명시한 **의도된
   예외**(User 가 워크스페이스 비종속 리소스)이며, 이번 target 문구는 그 예외를 그대로 참조할 뿐 새로운
   우회를 만들지 않는다.
3. **413 `PAYLOAD_TOO_LARGE` 전역 코드 재사용 원칙** — `2-api-convention.md` Rationale "413
   `PAYLOAD_TOO_LARGE`(전역) — 도메인 `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 와 공존"이 못박은 "일반 신규
   코드는 전역 코드를 쓰고, 도메인 특화 한도가 있을 때만 별도 코드를 신설" 원칙을, 아바타 2MB 초과 응답이
   `AVATAR_FILE_TOO_LARGE` 같은 신규 코드 대신 기존 전역 `PAYLOAD_TOO_LARGE`(413)를 그대로 재사용해
   **정확히 준수**한다(`spec/2-navigation/9-user-profile.md` §6.1 API 표·e2e 테스트로 확인).
4. **`FILE_REQUIRED`/`INVALID_FILE_TYPE` 신규 코드 등재** — `INVALID_FILE_TYPE` 은 이미 KB 문서 업로드가
   써 온 코드를 아바타가 공용하는 것으로(코드 확인: `knowledge-base.service.ts:928`), `FILE_REQUIRED` 는
   아바타가 처음 도입하는 코드로 target 문서에 정확히 그렇게 명시돼 있다 — 재사용/신설 구분이 코드 사실과
   일치.

## 요약

이번 target 델타는 `spec/5-system/2-api-convention.md` §9(파일 업로드)와
`spec/5-system/3-error-handling.md` §1.3(신규 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 등재) 두 곳뿐이며,
둘 다 아바타 이미지 업로드(공개 버킷) 신기능을 반영한다. "아바타는 업로드 엔드포인트가 없다"는 기존 문구를
뒤집지만 그 문구는 `## Rationale`에서 유래한 기각-대안이 아니라 오래된 코드-동기화 시점의 사실 서술이었고,
이번 PR 은 이를 대체하는 결정(아바타 공개 URL 서빙, 워크스페이스 비종속 S3 키)에 대해 `0-overview.md`·
`data-flow/4-file-storage.md`·`user-profile.md` 세 곳에 정합된 새 Rationale 을 이미 함께 기록해 뒀다.
413 코드 재사용 원칙(도메인 특화 코드는 필요할 때만 신설)도 그대로 지켜졌고, 워크스페이스 스코핑 원칙에
대한 예외도 기존 Rationale 이 이미 승인한 예외 범위 안에 있다. 유일하게 남는 것은 §7 Rate Limiting 표에
새 업로드 엔드포인트 행이 빠진 completeness gap(INFO) 뿐이며, 이는 Rationale 위반이 아니라 표 갱신
누락이다.

## 위험도

LOW
