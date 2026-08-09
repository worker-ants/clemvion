# Cross-Spec 일관성 검토 — spec-draft-secret-store-verification-footnote

## 검토 대상

`plan/in-progress/spec-draft-secret-store-verification-footnote.md` — `spec/conventions/secret-store.md`
§2.1 `†` 각주 마지막 문단("알려진 검증 공백")을 삭제하고 "검증은 두 층으로 갈라 고정한다" 문단으로
대체하는 순수 정정. 신규 엔티티·필드·endpoint·요구사항 ID·상태 전이·RBAC 규칙을 일절 도입하지 않는다.

## 확인한 사실

- `spec/conventions/secret-store.md:91-94` 의 현재 내용이 target 이 "제거"할 문단으로 인용한 텍스트와
  정확히 일치한다 (실측, `Read` 로 직접 대조).
- `spec/**` 전체에서 이 각주 문단("알려진 검증 공백" 등 관련 문구)을 인용·참조하는 다른 spec 파일은
  없다 (`grep -rn` 결과: `spec/1-data-model.md:778` 의 `deleteByPrefix` 언급은 cascade 설명일 뿐 이
  검증 공백 문단과 무관).
- `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속(라인 321-340)이 이 정정을 이미
  "미체크 항목" 으로 선행 기록해 두었고, 두 세션이 같은 항목의 양쪽 끝을 잡았다는 경위 서술이
  target draft 와 완전히 정합한다 — 별도 spec 이나 plan 과의 서술 충돌 없음.
- `#1113` (`2ed145e39`, "LIKE 근거 e2e") 커밋이 `origin/main` 이력에 실존해 target 의 실측 표 근거를
  뒷받침한다.
- target 의 `code:` frontmatter 비변경 결정(Rationale 항목)은 `spec-code-paths` 의 "글로브 ≥1 매치"
  요구와 충돌하지 않음 — target 스스로 그 근거를 명시했고 실제 관례(`spec-impl-evidence.md §3`)와도
  일치.

## 발견사항

없음. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 모두 target 의 변경
범위(각주 산문 텍스트 교체) 밖이라 충돌 표면 자체가 존재하지 않는다.

## 요약

이 target 은 이미 구현·검증된 사실(#1113)을 spec 이 아직 반대로 서술하고 있는 것을 바로잡는 순수
문서 정정이며, 새 결정·새 계약·새 ID를 도입하지 않는다. 교체 전/후 문단 모두 §2.1 각주 범위 안에
머물고, 다른 spec 영역에서 이 각주를 인용하는 곳이 없어 side-effect 전파 위험도 없다. 실측 결과
target 이 인용한 현재 spec 텍스트·커밋 이력·plan 서술이 모두 일치해 cross-spec 관점에서 조정할
사항이 없다.

## 위험도

NONE
