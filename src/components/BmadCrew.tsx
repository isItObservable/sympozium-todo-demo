import React, { useState } from 'react';

interface CrewMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'offline' | 'busy';
}

interface BmadCrewProps {
  crewMembers?: CrewMember[];
  onMemberClick?: (member: CrewMember) => void;
}

const DEFAULT_CREW: CrewMember[] = [
  { id: '1', name: 'Amelia', role: 'Senior Engineer', avatar: '', status: 'online' },
  { id: '2', name: 'Buddy', role: 'QA Specialist', avatar: '', status: 'busy' },
  { id: '3', name: 'Charlie', role: 'DevOps', avatar: '', status: 'offline' },
];

const statusColors: Record<CrewMember['status'], string> = {
  online: 'bg-green-400',
  offline: 'bg-gray-400',
  busy: 'bg-red-400',
};

export const BmadCrew: React.FC<BmadCrewProps> = ({
  crewMembers = DEFAULT_CREW,
  onMemberClick,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (member: CrewMember) => {
    setSelectedId(member.id);
    onMemberClick?.(member);
  };

  return (
    <div className="bmad-crew">
      <h2 className="bmad-crew__title">BMAD Crew</h2>
      <ul className="bmad-crew__list">
        {crewMembers.map((member) => (
          <li
            key={member.id}
            className={`bmad-crew__item ${selectedId === member.id ? 'bmad-crew__item--selected' : ''}`}
            onClick={() => handleSelect(member)}
            role="button"
            tabIndex={0}
            aria-label={`${member.name} - ${member.role}`}
          >
            <div className="bmad-crew__avatar-wrapper">
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="bmad-crew__avatar"
                />
              ) : (
                <div className="bmad-crew__avatar-placeholder">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`bmad-crew__status ${statusColors[member.status]}`}
                aria-label={member.status}
              />
            </div>
            <div className="bmad-crew__info">
              <span className="bmad-crew__name">{member.name}</span>
              <span className="bmad-crew__role">{member.role}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BmadCrew;
