# Rationale 연속성 검토 — `spec-draft-avatar-storage-key.md`

## 발견사항

- **[WARNING]** `spec/data-flow/0-overview.md` §"KB 원본 문서 S3 key 구조" 의 배타적 서술이
  이 draft 의 수정 범위 밖에 남는다
  - target 위치: `plan/in-progress/spec-draft-avatar-storage-key.md` frontmatter `spec_impact`
    (4개 파일) — `spec/data-flow/0-overview.md` 가 목록에 없음. 본문에서도 이 파일을
    언급하지 않는다.
  - 과거 결정 출처: `spec/data-flow/0-overview.md` `## Rationale` § "KB 원본 문서 S3 key 구조"
    (실측 `:269`~`:274`) — "**KB 원본 키만** `workspaceId` prefix 를 제외한다"
    (`정합하며, KB 원본 키만 workspaceId prefix 를 제외한다 (워크스페이스 격리는 DB 권한
    검증으로 보장 — prefix scan 비용·키 길이 절감)`).
  - 상세: 이 문장은 정확히 이 draft 가 `spec/0-overview.md` `## Rationale`("§B")에서 고치려는
    바로 그 **배타적 서술**("KB 하나뿐")과 같은 주장을 별도 문서에서 **한 번 더** 하고 있다.
    draft §B 가 `spec/0-overview.md` 를 "KB 원본 문서 키와 Avatar 키, 두 영역" 으로 정정하면,
    `data-flow/0-overview.md` 는 여전히 "KB 원본 키만" 이라 말하는 상태로 남아 두 문서가
    서로 모순하게 된다. 이 문장 바로 앞 절이 `동 문서 Rationale "S3 객체 키 prefix 설계" 와
    정합하며` 라고 명시적으로 0-overview.md 를 정본으로 인용하고 있어, 0-overview.md 갱신 뒤
    이 문장만 stale 로 남으면 "정합" 주장 자체가 거짓이 된다. draft 본문의 자체 논리
    (§"왜 Rationale 절까지 고쳐야 하는가": "Rationale 이 더 강한 문서이므로 표가 오기로 읽힐
    수 있다")가 이 파일에도 동일하게 적용된다 — 다만 draft 는 그 논리를 `spec/0-overview.md`
    자신에만 적용하고 자매 문서에는 적용하지 않았다.
  - 이 누락은 draft 고유의 새 결함이 아니라 위임 트래커
    (`plan/in-progress/spec-update-avatar-upload-implemented.md`)의 "같은 사실을 말하는 다른
    SoT 문서" 체크리스트에도 없던 것을 그대로 이어받은 것이다 — 즉 트래커 단계에서부터 있던
    스코프 누락이 이 draft 에도 이어졌다.
  - 제안: `spec_impact` 에 `spec/data-flow/0-overview.md` 를 추가하고, 해당 절 문구를
    "KB 원본 키만" → "KB 원본 키와 Avatar 키" (또는 "0-overview.md §2.7 Rationale 참조"로
    범위를 좁히고 exclusivity 서술 자체를 제거)로 정정한다. draft §E(앵커 링크 동반 갱신)와
    같은 패턴으로 처리 가능 — 텍스트 인용이라 앵커 grep 으로는 안 잡히므로 별도 항목화 필요.

- **[WARNING]** `spec/data-flow/4-file-storage.md` Rationale 의 "S3 GET 은 서버사이드
  뿐이다" 서술이 아바타의 공개 브라우저 GET 도입 후에도 갱신 대상에서 빠져 있다
  - target 위치: draft §C (`C-1`~`C-5`, `spec/data-flow/4-file-storage.md` 본문 §1.2/§1.3,
    §2.1/§2.2/§2.3 변경) — Rationale 절은 §E 의 **앵커 링크 한 줄**만 건드리고 본문 문장은
    그대로 둔다.
  - 과거 결정 출처: `spec/data-flow/4-file-storage.md` `## Rationale` §"S3 key 패턴: workspace
    prefix 를 두지 않는 이유" (실측 `:127`) — "현재 코드에는 클라이언트용 다운로드 엔드포인트나
    presigned URL(...) 사용처가 없다 — **S3 GET 은 worker 임베딩 단계의 서버사이드
    `s3Service.download` 뿐이다.**"
  - 상세: 이 draft 가 신설하는 §1.3(아바타 업로드, 구현됨)은 정확히 "클라이언트(브라우저)가
    S3 객체를 직접 GET 하는" 새 경로를 도입한다(공개 버킷 + 공개 URL, `s3.publicBaseUrl`).
    presigned URL 은 아니지만 "S3 GET 은 서버사이드 뿐" 이라는 문장의 사실 관계 자체가
    이 draft 이후로는 더 이상 참이 아니게 된다 — 브라우저가 `avatars/...` 오브젝트를 익명
    `GetObject` 로 직접 읽는다. 이 문장은 KB 섹션 범위로 좁게 쓰였다는 점에서 §B 의
    배타성 문제만큼 심각하지는 않지만("현재 코드에는" 이라는 문두가 이 draft 로 거짓이 된다는
    점에서), 다음 사람이 이 절만 보고 "이 시스템은 S3 GET 을 항상 서버 경유로만 한다"고
    오해할 수 있다.
  - 제안: 이 문장 뒤에 "(아바타는 예외 — §2.7/D-3 참조, 공개 버킷 익명 GetObject)" 정도의
    한정을 붙이거나, draft §C 의 범위를 이 Rationale 문단까지 넓힌다.

- **[INFO]** `data-flow/4-file-storage.md` 앵커 링크 갱신(§E)이 실측 grep 기반이라 인용
  문자열(비-링크 텍스트)까지는 포착하지 못함을 명시
  - target 위치: draft §E
  - 과거 결정 출처: 해당 없음(방법론 코멘트)
  - 상세: §E 는 `grep -rn "s3-객체-키-prefix-설계" spec/` 로 앵커 **링크**만 찾아 2곳을 갱신한다.
    위 두 WARNING 항목은 앵커 링크가 아니라 산문 텍스트로 같은 주장을 반복하는 사례라 이
    grep 으로는 안 잡힌다. 이번 리뷰가 잡아낸 패턴과 같은 종류의 검색을 완결하려면 앵커
    grep 외에 `"KB.*만"`/`"KB 원본.*제외"` 류의 텍스트 검색도 함께 돌리는 편이 안전하다.

## 요약

이 draft 자체는 원래 BLOCK 을 낸 `spec/0-overview.md` `## Rationale`("S3 객체 키 prefix
설계")의 배타적 서술을 정확히 겨냥해 고치고, 새 Rationale(소유 모델 근거·UUID 접근통제
근거·기각한 대안 3가지)을 충실히 작성한다 — 대상 4개 spec 문서 내에서는 기각된 대안의
무단 재도입도, 근거 없는 결정 번복도 없다. 다만 같은 "KB 원본 키만 workspaceId 를 제외한다"는
배타적 주장이 `spec/data-flow/0-overview.md` 라는 **자매 문서**에도 산문으로 존재하는데,
이 draft 의 `spec_impact` 범위와 위임 트래커 양쪽 모두 그 문서를 놓쳐, `spec/0-overview.md`
를 고친 뒤에도 저장소 안에 상호 모순하는 Rationale 서술 두 개가 공존하게 된다. 이는 이
draft 가 스스로 세운 원칙("본문·표만 고치면 충돌이 남는다 — Rationale 이 더 강한 문서")을
자기 자신에게는 적용했지만 인접 문서에는 적용하지 못한, 동일 클래스의 누락이다. `data-flow/
4-file-storage.md` 의 "S3 GET 은 서버사이드 뿐" 서술도 아바타의 공개 브라우저 GET 도입으로
사실관계가 바뀌었으나 갱신 대상에서 빠져 있다. 둘 다 CRITICAL 수준의 원칙 위반(기각된 대안
재도입)은 아니고 draft 가 아직 in-progress 이므로 병합 전 보완 가능한 WARNING 이다.

## 위험도
MEDIUM
