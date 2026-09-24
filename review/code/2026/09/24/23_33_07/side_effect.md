# 부작용(Side Effect) 리뷰 — MinIO 이미지 `pgsty/silo` 교체

## 발견사항

- **[INFO]** 공유 영속 볼륨(`minio_data`)에 대한 단방향 상태 변경 — 새 이미지가 옛 이미지가 모르는 설정을 쓴다
  - 위치: `docker-compose.yml:31`~`43` (주석) / `plan/in-progress/minio-silo-image.md` §C 호환성 표 "역방향(silo 가 쓴 볼륨을 옛 MinIO 로)" 행
  - 상세: dev `docker-compose.yml` 의 `minio` 서비스는 `minio_data` 라는 영속 볼륨을 그대로 재사용한다(`docker-compose.yml:50`, 변경 없음). PR 저자 스스로의 실측에 따르면 `pgsty/silo` 는 그 볼륨에 옛 MinIO 가 모르는 LDAP 관련 설정 키(`sts_trusted_proxies`)를 남길 수 있고, 이후 다시 공식 MinIO 이미지로 되돌리면 그 키를 이해하지 못해 LDAP 설정을 끄는 경고 로그를 남긴다. 기능은 유지되지만 **공유 파일시스템 상태에 이미지 교체 방향에 따라 비대칭적인 잔여 효과**가 생긴다는 점에서 전형적인 "예상 밖 공유 상태 변경" 패턴이다. 이미 CHANGELOG·plan 문서에 공개돼 있어 은닉된 부작용은 아니지만, 다음에 이 볼륨을 다루는 사람(예: 임시 롤백)이 그 경고를 신규 결함으로 오인할 수 있다.
  - 제안: 이미 문서화돼 있으므로 추가 조치는 낮은 우선순위이나, `docker-compose.yml` 의 `minio_data` 볼륨 주석에도(현재는 plan 문서에만 있음) "이미지를 되돌리면 LDAP 관련 경고가 남을 수 있다"는 한 줄을 남겨 두면 다음 사람이 코드만 보고도 알 수 있다.

- **[INFO]** 동일 이미지 참조가 3개 파일(6개 지점)에 수동으로 중복돼 있어 향후 갱신 시 divergence 위험이 재발할 수 있는 구조
  - 위치: `docker-compose.yml:43`,`63` / `docker-compose.e2e.yml:69`,`82` / `k8s/overlays/local/infra-minio.yaml:41`,`103`
  - 상세: 이번 PR 자체는 grep으로 세 파일·여섯 줄을 전수 확인하고 앵커 매칭을 assert했다고 기록돼 있어(plan §E) 이번 diff 안에서는 6곳 모두 동일 태그+다이제스트로 정확히 일치한다(직접 확인함, 불일치 없음). 다만 이 구조 자체는 "같은 이미지 참조 문자열을 서로 다른 포맷(compose 두 종 + k8s manifest)의 여러 파일에 수동 동기화"해야 하는 상태이고, 바로 이 패턴 때문에 12일 전 `#1325`에서 세 번째 위치(k8s)가 리뷰 전까지 누락됐던 전례가 plan 문서에 스스로 기록돼 있다. 코드 차원의 단일 진실 지점(SoT)이 없어, 다음 레지스트리/버전 교체에서 같은 종류의 부분 반영 위험이 구조적으로 남아 있다.
  - 제안: 이번 PR 범위 밖으로 판단해도 무방하나(이미 plan에 인지됨), 후속으로 이미지 태그를 하나의 `.env`/Makefile 변수로 뽑아 세 파일이 참조하게 하면 이 클래스의 재발을 구조적으로 차단할 수 있다.

- **[INFO]** 외부 네트워크 의존 대상이 다시 한번 제3자 공급자로 이동(공급망 표면 변경) — 부작용이 아니라 근본 원인의 반복
  - 위치: `docker-compose.yml:31`~`43`, `docker-compose.e2e.yml:65`~`69`, `k8s/overlays/local/infra-minio.yaml:37`~`41`
  - 상세: CI/dev 부팅 시 이미지 pull 이 바라보는 레지스트리·계정이 `quay.io/minio/*` 에서 Docker Hub 의 커뮤니티 포크 `pgsty/silo` 로 바뀐다. 애플리케이션 코드가 발생시키는 의도치 않은 네트워크 호출은 아니며 인프라 부팅 경로의 의도된 변경이지만, "네트워크 호출 대상이 바뀐다"는 사실 자체는 부작용 관점에서 기록할 가치가 있다 — 12일 사이 두 번째 레지스트리 폐쇄로 인한 이동이라, 세 번째 발생 시 똑같은 전체 e2e 마비가 재현될 수 있는 구조적 취약점을 그대로 승계한다. 이 점은 `plan_coherence` INFO #8·SUMMARY.md 에도 이미 지적돼 있다.
  - 제안: 이미 처분 기록됨(재발 시 GHCR 미러링 재검토). 추가 조치 불요.

- **[INFO]** plan 자체 체크리스트 기준 "TEST WORKFLOW"·"`/ai-review`" 가 아직 미완료로 표시됨
  - 위치: `plan/in-progress/minio-silo-image.md` §E 체크리스트 (`- [ ] TEST WORKFLOW …`, `- [ ] /ai-review …`)
  - 상세: §C 호환성 실측 표는 "이 저장소 파일은 바꾸지 않고" scratch 환경에서 compose override 로 이미지만 바꿔 돌린 결과라고 스스로 명시한다. 즉 이번 diff 로 실제 변경된 파일(`docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`) 그 자체를 사용한 전체 TEST WORKFLOW(lint·unit·build·e2e) 실행 완료 여부가 체크리스트상 아직 확인되지 않은 상태로 diff 가 리뷰에 올라왔다. 실측이 대리(override) 환경에서 이뤄졌다는 점 자체가 "실제 반영 파일 기준으로는 아직 검증되지 않은 부작용이 있을 수 있다"는 잔여 위험이다.
  - 제안: 리뷰 통과 여부와 무관하게, 병합 전 이 체크리스트의 두 항목(`TEST WORKFLOW`, `/ai-review`)을 실제 변경 파일 기준으로 완료해야 한다(plan 저자도 이미 그렇게 계획해 둠).

## 확인했으나 문제 없음

- 6개 이미지 참조 문자열(태그+다이제스트) 전부 `sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46` 로 정확히 일치함을 저장소 파일에서 직접 `grep` 하여 확인 — 불일치·오타 없음.
- `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`/`S3_*`/헬스체크 경로/콘솔 포트 등 기존 환경변수·설정 키는 그대로 유지되며 신규 전역 상태나 새 환경변수 도입 없음.
- 코드(백엔드/프런트엔드 TypeScript) 시그니처·공개 API 변경 없음 — 변경은 인프라 설정 파일(YAML) 과 문서(`CHANGELOG.md`, `plan/**`)에 한정.
- `review/consistency/2026/09/24/23_12_45/**` 신규 파일들은 `--impl-prep` 게이트가 정상적으로 산출한 감사 artifact이며, 프로젝트 컨벤션(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)과 일치. 절대경로가 일부 포함돼 있으나(`meta.json`/`_retry_state.json`) 이는 하네스가 세션 경로를 기록하는 기존 관례이고 비밀정보 유출은 없음.
- k8s Job(`minio-create-bucket`)이 아바타 공개 정책(`mc anonymous set-json`)을 걸지 않는 것은 이번 diff 가 새로 만든 결함이 아니라 기존 gap이며, PR 저자가 스스로 발견해 별도 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재했다.

## 요약

이번 변경은 코드(백엔드/프런트엔드)를 전혀 건드리지 않는 순수 인프라 설정(3개 YAML) + 문서(CHANGELOG·plan) 변경으로, 함수 시그니처·공개 API·전역 변수·환경변수 읽기/쓰기 관점에서 새로 도입되는 부작용은 없다. 유일하게 실질적인 "부작용"은 공유 영속 볼륨(`minio_data`)에 이미지 교체 방향에 따라 비대칭적으로 남는 설정 키(LDAP 경고)이며, 이는 PR 저자가 직접 실측해 CHANGELOG·plan 양쪽에 투명하게 공개한 상태다. 그 외 지적 사항은 전부 INFO 수준으로, 세 파일에 이미지 참조를 수동 동기화해야 하는 구조적 재발 위험과, 외부 레지스트리 의존이라는 근본 원인이 형태만 바뀐 채 반복된다는 점, 그리고 plan 체크리스트상 실제 변경 파일 기준 전체 테스트가 아직 완료 표시되지 않았다는 점이다. 저장소 파일에 대한 뮤테이션 검증은 수행하지 않았다(읽기 전용 `grep`/`Read` 만 사용, 원복 불요 — `git status --short` 로 트리 무변경 확인).

## 위험도

LOW
