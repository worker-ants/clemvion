# 문서화(Documentation) 리뷰 결과

대상: `entity-nullable-column-type-mismatch` 배치 3 리뷰 1R 조치 커밋(`af1651264`,
`fix(entity): 배치 3 리뷰 1R — 스코프 아웃했던 W1 을 뒤집고, 훑기 방법이 좁았던 것을 고쳤다`).
`CHANGELOG.md` 신규 항목, `AuthConfigDto.ipWhitelist` nullable 정정, plan 문서 INFO 반영,
직전 리뷰 라운드(`review/code/2026/09/03/18_30_53/**`) 산출물 커밋으로 구성된다.

## 발견사항

- **[WARNING]** plan 문서 "새로 드러난 축" 절이 **같은 커밋이 만든 CHANGELOG·코드 변경과
  모순**한다 — `AuthConfigDto.ipWhitelist` 를 여전히 "안 고친 것"으로 서술
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:251,257,260,261`
    (§배치 3 "새로 드러난 축 — 응답 DTO 가 nullable 필드를 non-null 로 문서화한다")
  - 상세: 이 절은 `AuthConfigDto.ipWhitelist: string[]` 를 예로 들며 **"이 PR 에서 고치지
    않았다"**(`:257`)· **"49건(12파일)"**(`:260`)· **"이 49 는 아직 작업 항목이 아니다"**(`:261`)
    라고 서술한다. 그런데 바로 이 커밋(`af1651264`)이:
    1. `auth-config-response.dto.ts` 의 `ipWhitelist` 를 정확히 `string[]` → `string[] | null`
       (`@ApiPropertyOptional({ nullable: true })`)로 **이미 고쳤고**,
    2. `CHANGELOG.md` 에 그 수정을 별도 항목으로 **문서화했으며**,
    3. 같은 커밋에 새로 추가된 `review/code/2026/09/03/18_30_53/RESOLUTION.md:9,33` 은
       "**W1 — `AuthConfigDto.ipWhitelist` (조치함, 판단을 바꿨다)**" · "**나머지 48건은
       여전히 별개 축이다**"라고 정확히 반대로 기록하고 있다.
    즉 리뷰 산출물(RESOLUTION)과 CHANGELOG·코드는 "48건 남았고 ipWhitelist 는 고쳤다"고
    말하는데, **plan 본문(결정 기록의 SoT)만 옛 상태("49건, ipWhitelist 미조치")를 그대로
    두고 있다.** `git show af1651264 -- plan/...md` 로 직접 대조한 결과, 이 커밋은 같은 절
    바로 위에 캐스트 표(§INFO#4)를 추가했지만 "새로 드러난 축" 문단 자체는 한 글자도
    건드리지 않았다 — 코드·CHANGELOG 는 갱신하면서 그 근거였던 plan 서술은 갱신에서
    빠졌다.
  - 제안: `:257` 문장에 "단 `ipWhitelist` 는 W1 로 이 커밋에서 예외적으로 정정했다(§CHANGELOG,
    RESOLUTION W1 참조)"를 취소선/각주로 반영하고, `:260` 의 "49건"을 "48건(ipWhitelist
    제외)"으로 갱신한다. 이 저장소는 plan 을 결정 기록의 단일 진실로 쓰므로(§체크리스트
    동기화 컨벤션, memory `feedback_stale_plan_claims_and_checklist_sync.md`), 다음 사람이
    이 절만 읽으면 "ipWhitelist 도 아직 안 고쳐진 49건 중 하나"로 오인해 같은 조사를
    반복하거나, 반대로 "고쳤다고 커밋 로그엔 있는데 plan 은 왜 다르게 말하나" 하고 신뢰를
    잃을 수 있다.

## 교차 검증 (참고용 — 발견사항 아님)

- `CHANGELOG.md:3-24` 신규 항목을 소스와 직접 대조 — 표(`ipWhitelist: string[]` →
  `ipWhitelist?: string[] | null`, `@ApiProperty` → `@ApiPropertyOptional({ nullable: true })`)가
  `auth-config-response.dto.ts` 실제 diff 와 정확히 일치. 인용한
  [API 규약 §5.4](spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략) 문구
  ("`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`",
  "본 규칙은 앞으로 도입·변경되는 필드에 적용한다")도 spec 원문과 정확히 일치함을 직접 열어
  확인했다.
- `spec/1-data-model.md:621` 은 이미 `ip_whitelist: String[]?` 로 nullable 문서화돼 있어
  이번 DTO 정정은 spec 을 따라가는 코드 쪽 수정이다 — spec 갱신 불필요.
- plan 의 나머지 RESOLUTION INFO 반영분(체크박스 `[x]` 전환 + "매 배치 반복 규칙" 명시,
  문장 접합부 인용 블록 분리, 캐스트 2곳 표 추가)은 실제로 반영됐음을 `git show af1651264`
  로 직접 확인 — 서술과 diff 가 일치한다.
- `review/code/2026/09/03/18_30_53/**` (RESOLUTION·SUMMARY·개별 리뷰어 산출물·`_retry_state.json`·
  `meta.json`)은 직전 라운드의 스냅샷을 그대로 커밋한 것으로, 리뷰 산출물 보존 관례상
  사후에 갱신할 대상이 아니다(오히려 위 WARNING 의 "정답"을 담고 있는 쪽이 이 디렉터리다).
- `scripts/backend-typecheck-baseline.json` 의 `total: 198→197` + `folders.service.spec.ts`
  항목 제거는 자체 주석("손으로 고치지 말고 `--update` 로 재생성")대로 자동 산출물이며
  손편집 흔적 없음.

## 요약

이번 커밋은 CHANGELOG·Swagger DTO·plan 체크박스 등 문서화 표면 대부분을 리뷰 1R 지적대로
정확히 갱신했고 특히 CHANGELOG 항목은 스펙 인용까지 정확하다. 다만 **plan 문서 자신의
"새로 드러난 축" 절이 같은 커밋이 만든 CHANGELOG·코드·리뷰 RESOLUTION 과 정면으로 모순**한다
— `AuthConfigDto.ipWhitelist` 를 "이 PR 에서 고치지 않았다"고 서술하는데 정확히 이 PR 이 그
필드를 고쳤다. 코드 자체의 결함은 아니지만(런타임·API 계약은 올바름), 결정 기록의 단일
진실이어야 할 plan 문서가 스스로를 반증하는 상태로 남아 있어 WARNING 으로 올린다.

## 위험도

LOW
