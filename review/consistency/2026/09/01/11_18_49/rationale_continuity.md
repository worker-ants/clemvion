# Rationale 연속성 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 발견사항

- **[WARNING]** `data-flow/4-file-storage.md` Rationale "이유" 문단이 Avatar 예외를 반영하지 못한 채 남는다
  - target 위치: §C (`C-5`/`C-6`), 특히 §C-6 이 편집하는 `:129`~`:131` 블록쿼트 **바로 위** 문단
  - 과거 결정 출처: `spec/data-flow/4-file-storage.md` `## Rationale` → `### S3 key 패턴: workspace prefix 를 두지 않는 이유` — "워크스페이스 prefix 가 없으므로 S3 정책(`s3:GetObject` IAM condition)의 키 prefix 만으로는 workspace 단위 격리를 강제하지 않는다. 대신 workspace 격리는 **DB 권한 검증**으로 보장한다"
  - 상세: 이 문장은 현재 이 파일에서 prefix 없는 키가 KB 하나뿐이던 시절 쓰인 "이유" 설명이다. target 의 §C-2 는 같은 문서 §2.1 표에 Avatar 행(`avatars/<userId>/<uuid>.<ext>`, "현재 사용 (공개 읽기)")을 추가하는데, 정작 그 표 바로 뒤에 오는 이 Rationale 문단은 손대지 않는다(§C 계획은 §2.1/§2.2/§2.3/앵커 링크(`:128`)/블록쿼트(`:129~131`)/상단 요약(`:19`)만 지목). 앵커 링크는 §E 가 `:128` 텍스트만 교체하도록 지시하므로, 그 링크가 걸린 **같은 문장**("워크스페이스 격리는 DB 권한 검증으로 보장한다")의 본문은 그대로 남는다. 편집 후 이 문단은 여전히 "prefix 없는 모든 키는 DB 권한 검증으로 격리된다"고 일반화해서 읽히는데, 같은 draft 가 `spec/0-overview.md` Rationale §B trade-off 에 새로 적는 문장("Avatar 는 **격리 대상이 아니다** — 공개 읽기가 제품 결정")과 정면으로 어긋난다. Avatar 는 DB 권한 검증이 아니라 UUID 추측불가성 + `ListBucket` 차단으로만 보호되므로, 이 문서 자신의 Rationale 문단이 미수정 상태로 남으면 같은 draft 가 다른 파일에서 새로 확정한 "Avatar 는 격리 대상 아님" invariant 를 이 문서 안에서 스스로 반박하는 모양이 된다 — target 이미 §"왜 Rationale 절까지 고쳐야 하는가"에서 정확히 이 실패 패턴("본문·표만 고치면 Rationale 이 낡은 채 남아 어느 쪽이 정본인지 알 수 없다")을 지적했음에도, 같은 패턴이 `0-overview.md` 한 곳에서만 고쳐지고 자매 문서(`4-file-storage.md`)의 대칭 문단에는 적용되지 않았다.
  - 제안: §C 에 항목을 하나 추가해 이 문단도 함께 고친다. 예: "워크스페이스 prefix 가 없는 키는 두 축으로 갈린다 — KB 원본은 prefix 를 빼되 workspace 격리를 **DB 권한 검증**으로 대체 보장하고, Avatar 는 애초에 **격리 대상이 아니다**(공개 읽기가 제품 결정, 근거는 [`0-overview.md` Rationale](../0-overview.md#s3-객체-키-prefix-설계--kb-원본과-avatar-키에서-workspaceid-제외-27))." — 근거 복제를 피하려는 target 자신의 원칙(§H 말미 "여기서 근거를 복제하면 세 번째 사본이 생긴다")과도 부합한다.

- **[WARNING]** `data-flow/0-overview.md :273`(§H) 편집 지시가 문구만 넓히면 KB 전용 근거가 Avatar 에 잘못 전이된다
  - target 위치: §H (`spec/data-flow/0-overview.md :273`)
  - 과거 결정 출처: `spec/data-flow/0-overview.md` `## Rationale` → `### KB 원본 문서 S3 key 구조` — "…정합하며, KB 원본 키만 `workspaceId` prefix 를 제외한다 (워크스페이스 격리는 DB 권한 검증으로 보장 — prefix scan 비용·키 길이 절감)."
  - 상세: §H 는 "KB 원본 키만" → "KB 원본 키와 Avatar 키가"로 **주어만** 넓히라고 지시하고, 뒤에 남는 처리는 "근거는 spec/0-overview.md Rationale 참조로 넘긴다"는 문장으로만 설명한다. 그런데 원문에서 그 참조 방식(근거 위임)이 적용될 대상은 괄호 안 전체 — "(워크스페이스 격리는 DB 권한 검증으로 보장 — prefix scan 비용·키 길이 절감)" — 인지, 아니면 주어 교체 후 이 괄호를 그대로 두는 것인지가 diff 예시 없이는 모호하다. 그대로 두면 "Avatar 키도 DB 권한 검증으로 격리되고, 이유는 prefix scan 비용·키 길이 절감"이라는 두 겹의 오기가 생긴다 — 둘 다 사실이 아니다(Avatar 는 소유 모델 근거이지 비용 근거가 아니고, DB 권한 검증이 아니라 공개 버킷+UUID 로 보호된다). 바로 이 오기가 §B 가 `0-overview.md` 자신의 Rationale 에서 명시적으로 갈라놓은 "KB=비용 근거 / Avatar=소유 모델 근거" 축 분리를 자매 문서에서 다시 뭉개는 결과가 된다.
  - 제안: §H 에 실제 diff 를 명시한다. 예: "…정합하며, KB 원본 키와 Avatar 키가 각각 다른 근거로 `workspaceId` prefix 를 제외한다 — 근거는 [`0-overview.md` Rationale](../0-overview.md#s3-객체-키-prefix-설계--kb-원본과-avatar-키에서-workspaceid-제외-27) 참조." 로 바꾸고, "(워크스페이스 격리는 DB 권한 검증으로 보장 — prefix scan 비용·키 길이 절감)" 괄호는 **삭제**(KB 전용 근거를 이 요약 문장에 남기지 않음 — 상세는 링크로 위임)하도록 diff 예시를 §H 본문에 추가할 것.

## 요약

target 은 `spec/0-overview.md` §2.7 본문·표·Rationale(§A~§B)에서는 "기각된 결정을 이유 없이 되살리는" 실패 없이, 과거 배타적 서술("workspaceId 제외는 KB 뿐")을 KB(비용 근거)와 Avatar(소유 모델 근거)로 명시적으로 갈라 새 Rationale 을 함께 기록했고, `9-user-profile.md §6.1`·`5-system/2-api-convention.md §9`·`5-system/3-error-handling.md` 등 BLOCK 을 낸 문서들의 정정도 근거를 갖춰 다뤘다 — target 스스로가 "Rationale 이 더 강한 문서"라는 이 저장소의 규약을 정확히 이해하고 §B 를 핵심 변경으로 명시한 점은 연속성 관점에서 견고하다. 다만 그 원칙을 `spec/0-overview.md` 한 곳에는 철저히 적용했으면서, 같은 "DB 권한 검증으로 격리를 보장한다"는 invariant 진술이 반복되는 두 자매 위치 — `data-flow/4-file-storage.md` 의 로컬 Rationale 문단과 `data-flow/0-overview.md :273` 편집 지시의 모호성 — 에는 대칭적으로 적용되지 않아, 편집이 계획대로 실행되면 두 문서가 "Avatar 는 DB 권한 검증으로 격리된다(구 서술 잔존)" vs "Avatar 는 격리 대상이 아니다(`0-overview.md` 신규 Rationale)"로 상호 모순하는 상태가 남을 위험이 있다. 둘 다 대안의 재도입이나 원칙 위반이 아니라 "같은 편집 패턴을 두 곳에서 한 곳에만 적용한" 완결성 gap 이므로 CRITICAL 은 아니지만, 보안 경계(공개 읽기 vs DB 권한 검증) 서술이 걸려 있어 방치 시 다음 사람이 잘못된 격리 모델을 전제로 판단할 수 있다.

## 위험도
MEDIUM
