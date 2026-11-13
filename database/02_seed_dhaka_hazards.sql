-- Seed 12 realistic dummy hazard pins across Dhaka covering all 5 categories
INSERT INTO hazards (
  category,
  severity,
  latitude,
  longitude,
  landmark_context,
  sub_tag,
  status
)
VALUES
  (
    'pothole_manhole',
    'Critical',
    23.7561,
    90.3752,
    'Dhanmondi 27, near Rapa Plaza',
    'Open manhole without cover',
    'crowd_verified'
  ),
  (
    'waterlogging',
    'Critical',
    23.8069,
    90.3687,
    'Mirpur 10 Circle, opposite Shah Ali Plaza',
    'Knee-deep rainwater',
    'active'
  ),
  (
    'unsafe_footbridge',
    'Critical',
    23.7572,
    90.3899,
    'Farmgate Footbridge near Ananda Cinema',
    'Broken steps and unlit stairs',
    'crowd_verified'
  ),
  (
    'unlit_alley',
    'Medium',
    23.7784,
    90.3984,
    'Underneath Mohakhali Flyover, Amtoli side',
    'Broken streetlights',
    'active'
  ),
  (
    'waterlogging',
    'Medium',
    23.7805,
    90.4266,
    'Middle Badda Link Road',
    'Drain overflow',
    'active'
  ),
  (
    'extortion_spot',
    'Medium',
    23.7389,
    90.3958,
    'Shahbagh Mor near Public Library gate',
    'Illegal street toll',
    'active'
  ),
  (
    'pothole_manhole',
    'Medium',
    23.7330,
    90.4172,
    'Motijheel Shapla Chattar service lane',
    'Deep pothole',
    'active'
  ),
  (
    'unlit_alley',
    'Low',
    23.8759,
    90.3795,
    'Uttara Sector 7, Road 12',
    'Dim street lighting',
    'resolved'
  ),
  (
    'extortion_spot',
    'Critical',
    23.7654,
    90.3587,
    'Mohammadpur Town Hall Market approach',
    'Late-night toll collection',
    'crowd_verified'
  ),
  (
    'unsafe_footbridge',
    'Low',
    23.7937,
    90.4066,
    'Banani Kakoli Footbridge',
    'Slippery tiles when wet',
    'active'
  ),
  (
    'pothole_manhole',
    'Critical',
    23.7104,
    90.4350,
    'Jatrabari Flyover ramp, Demra side',
    'Collapsed asphalt',
    'crowd_verified'
  ),
  (
    'unlit_alley',
    'Medium',
    23.7647,
    90.3886,
    'Bijoy Sarani side lane toward Tejgaon',
    'Dark pedestrian stretch',
    'active'
  );
